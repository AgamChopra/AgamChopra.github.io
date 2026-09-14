(() => {
"use strict";
/* Canvas 2D refraction for browsers/devices where WebGL is unavailable.
 * Uses the same rounded lens, displacement and RGB paths as the GPU renderer.
 * Geometry and blurred scene levels are cached; only visible panels are drawn.
 */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function smoothstep(a, b, value) {
    const t = clamp((value - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}
function distance(x, y, width, height, radius) {
    const qx = Math.abs(x) - width / 2 + radius;
    const qy = Math.abs(y) - height / 2 + radius;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

// Separable running-sum blur: O(pixels), independent of blur radius.
function blur(source, width, height, radius) {
    if (radius < 1) return source;
    const horizontal = new Uint8ClampedArray(source.length);
    const output = new Uint8ClampedArray(source.length);
    const diameter = radius * 2 + 1;
    for (let channel = 0; channel < 3; channel++) {
        for (let y = 0; y < height; y++) {
            const row = y * width * 4;
            let sum = 0;
            for (let k = -radius; k <= radius; k++) sum += source[row + clamp(k, 0, width - 1) * 4 + channel];
            for (let x = 0; x < width; x++) {
                horizontal[row + x * 4 + channel] = sum / diameter;
                sum += source[row + clamp(x + radius + 1, 0, width - 1) * 4 + channel]
                    - source[row + clamp(x - radius, 0, width - 1) * 4 + channel];
            }
        }
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let k = -radius; k <= radius; k++) sum += horizontal[(clamp(k, 0, height - 1) * width + x) * 4 + channel];
            for (let y = 0; y < height; y++) {
                output[(y * width + x) * 4 + channel] = sum / diameter;
                sum += horizontal[(clamp(y + radius + 1, 0, height - 1) * width + x) * 4 + channel]
                    - horizontal[(clamp(y - radius, 0, height - 1) * width + x) * 4 + channel];
            }
        }
    }
    return output;
}

function geometry(width, height, w, h, material) {
    const { radius, edge, refraction, chromatic } = material;
    const map = new Float32Array(w * h * 8);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const lx = (x + 0.5) * width / w;
            const ly = (y + 0.5) * height / h;
            const px = lx - width / 2;
            const py = ly - height / 2;
            const d = distance(px, py, width, height, radius);
            const i = (y * w + x) * 8;
            if (d >= 0) continue;
            const amount = clamp((d + edge) / edge, 0, 1);
            const bevel = smoothstep(0, 1, amount);
            const qx = Math.abs(px) - width / 2 + radius;
            const qy = Math.abs(py) - height / 2 + radius;
            let nx = Math.max(qx, 0) * Math.sign(px);
            let ny = Math.max(qy, 0) * Math.sign(py);
            if (nx === 0 && ny === 0) {
                if (qx > qy) nx = Math.sign(px);
                else ny = Math.sign(py);
            }
            const length = Math.hypot(nx, ny) || 1;
            nx /= length; ny /= length;
            const bend = refraction * bevel;
            const dispersion = Math.min(bend, chromatic * 0.5 * bevel);
            map[i] = lx - nx * bend;
            map[i + 1] = ly - ny * bend;
            map[i + 2] = nx * dispersion;
            map[i + 3] = ny * dispersion;
            map[i + 4] = 1 - smoothstep(0.15, 0.72, amount) * 0.98;
            map[i + 5] = (1 - bevel) ** 2;
            const shadow = smoothstep(0, 6, distance(px, py - 3, width, height, radius)) * 0.10;
            const glow = smoothstep(0, 5, distance(px, py + 2, width, height, radius)) * 0.12;
            const reflection = Math.abs(nx * -0.6 + ny * -0.8) ** 6;
            map[i + 6] = -shadow + glow + smoothstep(0.83, 1, amount) * (0.055 + reflection * 0.19);
            map[i + 7] = 1 - smoothstep(-0.8, 0, d);
        }
    }
    return map;
}

class SoftwareGlass {
    constructor(image) {
        const source = document.createElement('canvas');
        const scale = Math.min(1, 1024 / image.naturalWidth);
        this.width = source.width = Math.round(image.naturalWidth * scale);
        this.height = source.height = Math.round(image.naturalHeight * scale);
        const context = source.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas 2D unavailable');
        context.drawImage(image, 0, 0, this.width, this.height);
        this.pixels = context.getImageData(0, 0, this.width, this.height).data;
        this.levels = new Map();
    }

    sample(pixels, x, y, channel) {
        x = clamp(x, 0, this.width - 1);
        y = clamp(y, 0, this.height - 1);
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        const nextX = Math.min(ix + 1, this.width - 1);
        const nextY = Math.min(iy + 1, this.height - 1);
        const a = pixels[(iy * this.width + ix) * 4 + channel];
        const b = pixels[(iy * this.width + nextX) * 4 + channel];
        const c = pixels[(nextY * this.width + ix) * 4 + channel];
        const d = pixels[(nextY * this.width + nextX) * 4 + channel];
        return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }

    render(record, size, material, scene, origin, dark) {
        const { width, height, w, h } = size;
        const key = [width, height, w, h, material.radius, material.edge, material.refraction, material.chromatic].join(':');
        if (record.softwareKey !== key) {
            record.softwareMap = geometry(width, height, w, h, material);
            record.softwareOutput = record.context.createImageData(w, h);
            record.softwareKey = key;
        }
        const ratioX = this.width / scene.width, ratioY = this.height / scene.height;
        const blurRadius = Math.round(material.frost * 0.866 * ratioX);
        let frosted = this.levels.get(blurRadius);
        if (!frosted) {
            frosted = blur(this.pixels, this.width, this.height, blurRadius);
            if (this.levels.size >= 8) this.levels.delete(this.levels.keys().next().value);
            this.levels.set(blurRadius, frosted);
        }
        const tint = dark ? [0.025, 0.068, 0.105] : [0.97, 0.988, 1];
        const map = record.softwareMap;
        const output = record.softwareOutput;
        const ox = origin.x - scene.x, oy = origin.y - scene.y;
        for (let pixel = 0; pixel < w * h; pixel++) {
            const i = pixel * 8, out = pixel * 4;
            const alpha = map[i + 7];
            if (!alpha) { output.data[out + 3] = 0; continue; }
            const frostMix = map[i + 5];
            const opacity = material.opacity * map[i + 4];
            for (let channel = 0; channel < 3; channel++) {
                const direction = 1 - channel;
                const sx = (ox + map[i] + map[i + 2] * direction) * ratioX;
                const sy = (oy + map[i + 1] + map[i + 3] * direction) * ratioY;
                let color = this.sample(frosted, sx, sy, channel);
                if (frostMix < 0.999) color = color * frostMix + this.sample(this.pixels, sx, sy, channel) * (1 - frostMix);
                output.data[out + channel] = color * (1 - opacity) + tint[channel] * 255 * opacity + map[i + 6] * 255;
            }
            output.data[out + 3] = alpha * 255;
        }
        if (record.canvas.width !== w) record.canvas.width = w;
        if (record.canvas.height !== h) record.canvas.height = h;
        record.context.putImageData(output, 0, 0);
    }
}

window.PortfolioGlass.SoftwareGlass = SoftwareGlass;
})();
