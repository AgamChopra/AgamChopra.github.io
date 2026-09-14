(() => {
"use strict";
const { vertexShaderSource, fragmentShaderSource, SoftwareGlass } = window.PortfolioGlass;

/* One WebGL context serves DOM-local canvases, preserving browser stacking,
 * sticky panels and accessible text. No screenshots or external runtime.
 * Only visible surfaces redraw, and idle pages schedule no animation frames.
 */
const root = document.documentElement;
const landscape = document.querySelector(".landscape");
const preferences = [
    "(prefers-reduced-transparency: reduce)",
    "(prefers-contrast: more)",
    "(forced-colors: active)",
].map((query) => matchMedia(query));
const selector = [
    "[data-liquid-glass]", ".metrics-glass-root", ".section-intro", ".timeline-item",
    ".education-grid > article", ".publication-list > li", ".skill-groups > article",
    ".site-footer",
].join(",");
const records = [...document.querySelectorAll(selector)].map((element) => {
    element.classList.add("glass-surface");
    const canvas = document.createElement("canvas");
    canvas.className = "glass-texture";
    canvas.setAttribute("aria-hidden", "true");
    const rim = document.createElement("span");
    rim.className = "glass-rim";
    rim.setAttribute("aria-hidden", "true");
    element.prepend(canvas, rim);
    return { element, canvas, context: canvas.getContext("2d"), visible: false, dirty: true };
});
const buffer = document.createElement("canvas");
let backend = "webgl";
let software;
// Local-file images have opaque origins in some browsers. Loading the
// existing image bytes as data URLs allows both WebGL and Canvas 2D sampling.
// HTTP pages never download the embedded asset.
const localScenesReady = location.protocol === "file:"
    ? new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "assets/backgrounds/local-scenes.js?v=20260914-standalone";
        script.onload = () => {
            const scenes = window.PortfolioGlass.localScenes;
            if (!scenes?.light || !scenes?.dark) {
                reject(new Error("Local preview backgrounds are missing"));
                return;
            }
            for (const theme of ["light", "dark"]) {
                const image = document.querySelector(`.landscape-${theme}`);
                image.removeAttribute("srcset");
                image.src = scenes[theme];
            }
            resolve();
        };
        script.onerror = () => reject(new Error("Unable to load local preview backgrounds"));
        document.head.append(script);
    })
    : Promise.resolve();
let gl;
let program;
let texture;
let uniforms;
let sourceImage;
let frame = 0;
let lastRender = 0;
let motionUntil = 0;
let imageGeneration = 0;
let failed = false;

function allowed() {
    return !failed && !preferences.some((query) => query.matches);
}
function fallback(error) {
    records.forEach(({ element, canvas }) => {
        element.classList.remove("glass-ready");
        canvas.hidden = true;
    });
    root.dataset.glass = "fallback";
    if (error) console.warn("Liquid glass: using CSS fallback.", error);
}
function compile(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
    }
    return shader;
}
function initialize() {
    gl = buffer.getContext("webgl", {
        alpha: true, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL unavailable");
    const vertex = compile(vertexShaderSource, gl.VERTEX_SHADER);
    const fragment = compile(fragmentShaderSource, gl.FRAGMENT_SHADER);
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries([
        "image", "size", "origin", "imageSize", "imageOrigin", "radius",
        "edge", "refraction", "chromatic", "frost", "tint",
    ].map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uniforms.image, 0);
}
async function loadTheme() {
    const generation = ++imageGeneration;
    sourceImage = null;
    fallback(); // Never show a stale landscape while the new theme decodes.
    if (!allowed()) return;
    const theme = root.dataset.theme === "dark" ? "dark" : "light";
    const nextImage = document.querySelector(`.landscape-${theme}`);
    try {
        await localScenesReady;
        if (generation !== imageGeneration || !allowed()) return;
        await nextImage.decode();
        if (generation !== imageGeneration || !allowed()) return;
        if (backend === "webgl") {
            try {
                if (!gl) initialize();
                // WebGL 1 needs power-of-two dimensions for mipmaps. Filtering
                // across these levels prevents aliasing where the lens heavily
                // compresses trees, stars and other fine background details.
                // The UV-to-viewport mapping restores the image's aspect ratio.
                const textureSource = document.createElement("canvas");
                const limit = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
                textureSource.width = Math.min(limit, 2 ** Math.ceil(Math.log2(nextImage.naturalWidth)));
                textureSource.height = Math.min(limit, 2 ** Math.ceil(Math.log2(nextImage.naturalHeight)));
                const textureContext = textureSource.getContext("2d");
                if (!textureContext) throw new Error("Unable to prepare glass texture");
                textureContext.drawImage(nextImage, 0, 0, textureSource.width, textureSource.height);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureSource);
                gl.generateMipmap(gl.TEXTURE_2D);
                if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL texture upload failed");
            } catch (error) {
                console.info("Liquid glass: switching to software refraction.", error.message);
                backend = "canvas";
            }
        }
        if (backend === "canvas") {
            const nextSoftware = new SoftwareGlass(nextImage);
            if (generation !== imageGeneration || !allowed()) return;
            software = nextSoftware;
        }
        sourceImage = nextImage;
        invalidate();
    } catch (error) {
        if (generation === imageGeneration) fallback(error);
    }
}
function invalidate() {
    records.forEach((record) => { record.dirty = true; });
    schedule();
}
function schedule() {
    if (!frame && allowed() && sourceImage && !document.hidden) {
        frame = requestAnimationFrame(render);
    }
}
function render(now) {
    frame = 0;
    if (!allowed() || !sourceImage || document.hidden) return;
    // Bound scroll and transition rendering to 30 fps.
    if (now - lastRender < (backend === "canvas" ? 64 : 32)) { schedule(); return; }
    lastRender = now;
    const moving = now < motionUntil;
    const viewport = landscape.getBoundingClientRect();
    const imageScale = Math.max(viewport.width / sourceImage.naturalWidth, viewport.height / sourceImage.naturalHeight);
    const imageWidth = sourceImage.naturalWidth * imageScale;
    const imageHeight = sourceImage.naturalHeight * imageScale;
    const dark = root.dataset.theme === "dark";
    const jobs = records.filter((record) => record.visible && (record.dirty || moving) && record.context)
        .map((record) => ({ record, rect: record.element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight);
    if (!jobs.length) { if (moving) schedule(); return; }
    try {
        const sizes = jobs.map(({ record }) => {
            const width = record.element.clientWidth;
            const height = record.element.clientHeight;
            const scale = Math.min(devicePixelRatio || 1, backend === "canvas" ? 1 : 1.5,
                Math.sqrt((backend === "canvas" ? 120000 : 600000) / Math.max(1, width * height)));
            return { width, height, w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
        });
        const scene = {
            width: imageWidth, height: imageHeight,
            x: viewport.left + (viewport.width - imageWidth) / 2,
            y: viewport.top + (viewport.height - imageHeight) / 2,
        };
        if (backend === "webgl") {
            const maxWidth = Math.max(...sizes.map(({ w }) => w));
            const maxHeight = Math.max(...sizes.map(({ h }) => h));
            if (buffer.width < maxWidth) buffer.width = maxWidth;
            if (buffer.height < maxHeight) buffer.height = maxHeight;
            gl.uniform2f(uniforms.imageSize, imageWidth, imageHeight);
            gl.uniform2f(uniforms.imageOrigin, scene.x, scene.y);
        }
        jobs.forEach(({ record, rect }, index) => {
            const { element, canvas, context } = record;
            const { width, height, w, h } = sizes[index];
            const style = getComputedStyle(element);
            const radius = Math.max(0, Math.min(parseFloat(style.borderTopLeftRadius) || 0, width / 2, height / 2) - 1);
            // CSS is the single source for panel-specific material settings;
            // its blur/tint also supplies the non-WebGL fallback.
            const parameter = (name, fallback, maximum) => {
                const value = Number.parseFloat(style.getPropertyValue(`--glass-${name}`));
                return Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : fallback;
            };
            const material = {
                radius,
                edge: Math.max(1, Math.min(parameter("thickness", 34, 80), width / 2, height / 2)),
                refraction: parameter("refraction", 68, 140),
                chromatic: parameter("chromatic", 12, 30),
                frost: parameter("frost", 0, 30),
                opacity: parameter("opacity", 0, 1),
            };
            const origin = { x: rect.left + element.clientLeft, y: rect.top + element.clientTop };
            if (backend === "canvas") {
                software.render(record, sizes[index], material, scene, origin, dark);
            } else {
                gl.viewport(0, 0, w, h);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.uniform2f(uniforms.size, width, height);
                gl.uniform2f(uniforms.origin, origin.x, origin.y);
                gl.uniform1f(uniforms.radius, material.radius);
                gl.uniform1f(uniforms.edge, material.edge);
                gl.uniform1f(uniforms.refraction, material.refraction);
                gl.uniform1f(uniforms.chromatic, material.chromatic);
                gl.uniform1f(uniforms.frost, material.frost);
                gl.uniform4f(uniforms.tint, ...(dark ? [0.025, 0.068, 0.105, material.opacity] : [0.97, 0.988, 1, material.opacity]));
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                if (canvas.width !== w) canvas.width = w;
                if (canvas.height !== h) canvas.height = h;
                context.clearRect(0, 0, w, h);
                context.drawImage(buffer, 0, buffer.height - h, w, h, 0, 0, w, h);
            }
            canvas.hidden = false;
            element.classList.add("glass-ready");
            record.dirty = false;
        });
        root.dataset.glass = backend;
    } catch (error) {
        if (backend === "webgl") {
            backend = "canvas";
            loadTheme();
        } else {
            failed = true;
            fallback(error);
        }
    }
    if (moving) schedule();
}
const recordByElement = new Map(records.map((record) => [record.element, record]));
const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
        const record = recordByElement.get(target);
        record.visible = isIntersecting;
        record.dirty = true;
        if (!isIntersecting) {
            // Release offscreen backing stores on long pages.
            record.canvas.width = record.canvas.height = 1;
            record.softwareMap = record.softwareOutput = record.softwareKey = null;
            record.element.classList.remove("glass-ready");
        }
    });
    schedule();
}, { rootMargin: "80px" });
const resizeObserver = new ResizeObserver(invalidate);
records.forEach(({ element }) => {
    visibilityObserver.observe(element);
    resizeObserver.observe(element);
});
addEventListener("scroll", invalidate, { passive: true });
addEventListener("resize", invalidate, { passive: true });
window.visualViewport?.addEventListener("resize", invalidate, { passive: true });
document.addEventListener("transitionrun", (event) => {
    if (["translate", "transform", "opacity"].includes(event.propertyName) && event.target.matches(".glass-surface, .metrics-glass-root")) {
        motionUntil = performance.now() + 1000;
        invalidate();
    }
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else invalidate();
});
addEventListener("pagehide", () => { cancelAnimationFrame(frame); frame = 0; });
addEventListener("pageshow", invalidate);
new MutationObserver(loadTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
preferences.forEach((query) => query.addEventListener("change", loadTheme));
document.querySelectorAll(".landscape-image").forEach((image) => image.addEventListener("load", () => {
    if (image.classList.contains(`landscape-${root.dataset.theme}`)) loadTheme();
}));
buffer.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    backend = "canvas";
    loadTheme();
});
buffer.addEventListener("webglcontextrestored", () => {
    gl = null;
    backend = "webgl";
    failed = false;
    loadTheme();
});
loadTheme();

})();
