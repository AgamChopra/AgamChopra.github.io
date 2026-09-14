(() => {
"use strict";
/* Adapted from prabinpebam/liquid-glass, js/shaders.js, commit
 * c900ced7e5f3e068234f99d3efc1d7882e181771. See docs/visual-design.md.
 * Adapts rounded-box SDF, curved edge refraction, RGB dispersion, multi-sample
 * frosting and offset inner shadow/glow; replaces the demo editor scene.
 */
const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
    }
`;
const fragmentShaderSource = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform vec2 u_size;
    uniform vec2 u_origin;
    uniform vec2 u_imageSize;
    uniform vec2 u_imageOrigin;
    uniform float u_radius;
    uniform float u_edge;
    uniform float u_refraction;
    uniform float u_chromatic;
    uniform float u_frost;
    uniform vec4 u_tint;

    float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }
    float innerLight(vec2 p, vec2 offset, float blur) {
        return smoothstep(0.0, blur,
            sdRoundedBox(p + offset, u_size * 0.5, u_radius));
    }
    vec3 background(vec2 point) {
        vec2 uv = (point - u_imageOrigin) / u_imageSize;
        return texture2D(u_image, clamp(uv, 0.0, 1.0)).rgb;
    }
    void main() {
        // Top-left CSS coordinates, independent of drawing-buffer resolution.
        vec2 local = vec2(v_texCoord.x, 1.0 - v_texCoord.y) * u_size;
        vec2 p = local - u_size * 0.5;
        float distance = sdRoundedBox(p, u_size * 0.5, u_radius);
        float alpha = 1.0 - smoothstep(-0.8, 0.0, distance);
        if (alpha <= 0.0) discard;
        float edgeAmount = clamp((distance + u_edge) / u_edge, 0.0, 1.0);
        // A wide curved bevel: the central sheet stays flat, while the rim
        // compresses a substantial strip of the scene like a thick glass lens.
        float bevel = smoothstep(0.0, 1.0, edgeAmount);
        float distortion = u_refraction * bevel;
        // SDF normals make long edges refract perpendicular to the boundary.
        vec2 normal = vec2(
            sdRoundedBox(p + vec2(0.5, 0.0), u_size * 0.5, u_radius)
                - sdRoundedBox(p - vec2(0.5, 0.0), u_size * 0.5, u_radius),
            sdRoundedBox(p + vec2(0.0, 0.5), u_size * 0.5, u_radius)
                - sdRoundedBox(p - vec2(0.0, 0.5), u_size * 0.5, u_radius));
        normal /= max(length(normal), 0.001);
        vec2 sampleAt = u_origin + local;
        // Like upstream, each channel follows a separate refraction path.
        // Fade separation to zero at the inner edge to avoid a visible seam.
        float dispersion = u_chromatic * 0.5 * bevel;
        vec2 rOffset = normal * max(0.0, distortion - dispersion);
        vec2 gOffset = normal * distortion;
        vec2 bOffset = normal * (distortion + dispersion);
        float frost = u_frost * pow(1.0 - bevel, 2.0);
        vec3 color = vec3(0.0);
        float weightSum = 0.0;
        // Upstream's 5x5 frosting kernel, with binomial weights to reduce ghosting.
        // Split the RGB paths inside the blur, so frosting also affects dispersion.
        for (int x = -2; x <= 2; x++) {
            for (int y = -2; y <= 2; y++) {
                float wx = x == 0 ? 6.0 : (abs(float(x)) == 1.0 ? 4.0 : 1.0);
                float wy = y == 0 ? 6.0 : (abs(float(y)) == 1.0 ? 4.0 : 1.0);
                float weight = wx * wy;
                vec2 point = sampleAt + vec2(float(x), float(y)) * frost * 0.5;
                if (dispersion > 0.001) {
                    color += vec3(background(point - rOffset).r,
                        background(point - gOffset).g,
                        background(point - bOffset).b) * weight;
                } else {
                    color += background(point - gOffset) * weight;
                }
                weightSum += weight;
            }
        }
        color /= weightSum;
        // Clearer perimeter, stronger tint beneath the text.
        float clearRim = smoothstep(0.15, 0.72, edgeAmount);
        color = mix(color, u_tint.rgb, u_tint.a * (1.0 - clearRim * 0.98));
        color -= vec3(innerLight(p, vec2(0.0, -3.0), 6.0) * 0.10);
        color += vec3(innerLight(p, vec2(0.0, 2.0), 5.0) * 0.12);
        float rim = smoothstep(0.83, 1.0, edgeAmount);
        float reflection = pow(abs(dot(normal, normalize(vec2(-0.6, -0.8)))), 6.0);
        color += vec3(rim * (0.055 + reflection * 0.19));
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
    }
`;

window.PortfolioGlass = { vertexShaderSource, fragmentShaderSource };
})();
