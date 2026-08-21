(() => {
    "use strict";

    const root = document.documentElement;
    const surfaceSelector = [
        ".hero-copy",
        ".hero-panel",
        ".metrics",
        ".metrics > li",
        ".section-intro",
        ".timeline-item",
        ".education-grid article",
        ".publication-list li",
        ".skill-groups article",
    ].join(", ");

    const transparencyQuery = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const contrastQuery = window.matchMedia("(prefers-contrast: more)");
    const forcedColorsQuery = window.matchMedia("(forced-colors: active)");

    if (transparencyQuery.matches || contrastQuery.matches || forcedColorsQuery.matches) {
        return;
    }

    const stage = document.createElement("canvas");
    const source = document.createElement("canvas");
    const sourceContext = source.getContext("2d");
    const gl = stage.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false,
    });

    if (!gl || !sourceContext) {
        return;
    }

    stage.className = "shader-glass-stage";
    stage.setAttribute("aria-hidden", "true");

    const vertexSource = `
        attribute vec2 position;

        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    /*
     * The material constants and 9x9 sampling kernel below are retained from
     * the supplied example. uPanel only maps that lens to each DOM rectangle.
     */
    const fragmentSource = `
        precision mediump float;

        uniform vec3 iResolution;
        uniform float iTime;
        uniform vec4 uPanel;
        uniform float uRenderMode;
        uniform sampler2D iChannel0;

        void mainImage(out vec4 fragColor, in vec2 fragCoord) {
            const float NUM_ZERO = 0.0;
            const float NUM_ONE = 1.0;
            const float NUM_HALF = 0.5;
            const float NUM_TWO = 2.0;
            const float POWER_EXPONENT = 6.0;
            const float MASK_MULTIPLIER_1 = 10000.0;
            const float MASK_MULTIPLIER_2 = 9500.0;
            const float MASK_MULTIPLIER_3 = 11000.0;
            const float LENS_MULTIPLIER = 5000.0;
            const float MASK_STRENGTH_1 = 8.0;
            const float MASK_STRENGTH_2 = 16.0;
            const float MASK_STRENGTH_3 = 2.0;
            const float MASK_THRESHOLD_1 = 0.95;
            const float MASK_THRESHOLD_2 = 0.9;
            const float MASK_THRESHOLD_3 = 1.5;
            const float SAMPLE_RANGE = 4.0;
            const float SAMPLE_OFFSET = 0.5;
            const float GRADIENT_RANGE = 0.2;
            const float GRADIENT_OFFSET = 0.1;
            const float GRADIENT_EXTREME = -1000.0;
            const float LIGHTING_INTENSITY = 0.3;
            const float PANEL_NORMALIZATION = 0.21544347;

            vec2 uv = fragCoord / iResolution.xy;

            if (uRenderMode < NUM_HALF) {
                fragColor = texture2D(iChannel0, uv);
                return;
            }

            vec2 panelCenterPx = uPanel.xy + uPanel.zw * NUM_HALF;
            vec2 halfSize = uPanel.zw * NUM_HALF;
            float minimumHalfSize = max(NUM_ONE, min(halfSize.x, halfSize.y));
            float cornerRadius = min(
                clamp(min(uPanel.z, uPanel.w) * 0.055, 16.0, 26.0),
                minimumHalfSize - NUM_ONE
            );
            vec2 roundedRectOffset = abs(fragCoord - panelCenterPx) - (halfSize - vec2(cornerRadius));
            float signedDistance = length(max(roundedRectOffset, vec2(NUM_ZERO))) +
                min(max(roundedRectOffset.x, roundedRectOffset.y), NUM_ZERO) - cornerRadius;
            float edgeProgress = clamp(NUM_ONE + signedDistance / minimumHalfSize, NUM_ZERO, NUM_ONE);
            float roundedBox = pow(edgeProgress, POWER_EXPONENT) / MASK_MULTIPLIER_1;
            vec2 localUv = (fragCoord - uPanel.xy) / uPanel.zw;
            vec2 m2 = ((localUv - NUM_HALF) * NUM_TWO) * PANEL_NORMALIZATION;
            float rb1 = clamp((NUM_ONE - roundedBox * MASK_MULTIPLIER_1) * MASK_STRENGTH_1, NUM_ZERO, NUM_ONE);
            float rb2 = clamp((MASK_THRESHOLD_1 - roundedBox * MASK_MULTIPLIER_2) * MASK_STRENGTH_2, NUM_ZERO, NUM_ONE) -
                clamp((MASK_THRESHOLD_2 - roundedBox * MASK_MULTIPLIER_2) * MASK_STRENGTH_2, NUM_ZERO, NUM_ONE);
            float rb3 = clamp((MASK_THRESHOLD_3 - roundedBox * MASK_MULTIPLIER_3) * MASK_STRENGTH_3, NUM_ZERO, NUM_ONE) -
                clamp((NUM_ONE - roundedBox * MASK_MULTIPLIER_3) * MASK_STRENGTH_3, NUM_ZERO, NUM_ONE);

            fragColor = vec4(NUM_ZERO);
            float transition = smoothstep(NUM_ZERO, NUM_ONE, rb1 + rb2);

            if (transition > NUM_ZERO) {
                vec2 panelCenter = (uPanel.xy + uPanel.zw * NUM_HALF) / iResolution.xy;
                vec2 lens = ((uv - panelCenter) * NUM_ONE * (NUM_ONE - roundedBox * LENS_MULTIPLIER) + panelCenter);
                float total = NUM_ZERO;

                for (float x = -SAMPLE_RANGE; x <= SAMPLE_RANGE; x++) {
                    for (float y = -SAMPLE_RANGE; y <= SAMPLE_RANGE; y++) {
                        vec2 offset = vec2(x, y) * SAMPLE_OFFSET / iResolution.xy;
                        fragColor += texture2D(iChannel0, offset + lens);
                        total += NUM_ONE;
                    }
                }

                fragColor /= total;

                float gradient = clamp((clamp(m2.y, NUM_ZERO, GRADIENT_RANGE) + GRADIENT_OFFSET) / NUM_TWO, NUM_ZERO, NUM_ONE) +
                    clamp((clamp(-m2.y, GRADIENT_EXTREME, GRADIENT_RANGE) * rb3 + GRADIENT_OFFSET) / NUM_TWO, NUM_ZERO, NUM_ONE);
                vec4 lighting = clamp(fragColor + vec4(rb1) * gradient + vec4(rb2) * LIGHTING_INTENSITY, NUM_ZERO, NUM_ONE);

                fragColor = mix(texture2D(iChannel0, uv), lighting, transition);
            } else {
                discard;
            }
        }

        void main() {
            mainImage(gl_FragColor, gl_FragCoord.xy);
        }
    `;

    function createShader(type, shaderSource) {
        const shader = gl.createShader(type);

        if (!shader) {
            return null;
        }

        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn("Unable to compile the liquid-glass shader:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        return;
    }

    const program = gl.createProgram();

    if (!program) {
        return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn("Unable to link the liquid-glass shader:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return;
    }

    gl.useProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();

    if (!buffer || !texture) {
        return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
    );

    const position = gl.getAttribLocation(program, "position");
    const uniforms = {
        resolution: gl.getUniformLocation(program, "iResolution"),
        time: gl.getUniformLocation(program, "iTime"),
        panel: gl.getUniformLocation(program, "uPanel"),
        renderMode: gl.getUniformLocation(program, "uRenderMode"),
        texture: gl.getUniformLocation(program, "iChannel0"),
    };

    const requiredUniforms = [
        uniforms.resolution,
        uniforms.panel,
        uniforms.renderMode,
        uniforms.texture,
    ];

    if (position < 0 || requiredUniforms.some((location) => location === null)) {
        return;
    }

    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    document.body.prepend(stage);
    const surfaces = Array.from(document.querySelectorAll(surfaceSelector));
    const startTime = performance.now();
    let renderFrame = 0;
    let sourceNeedsUpdate = true;
    let contextLost = false;

    function cssColor(styles, property, fallback) {
        return styles.getPropertyValue(property).trim() || fallback;
    }

    function drawEllipticalGlow(context, width, height, x, y, radiusX, radiusY, color) {
        context.save();
        context.translate(width * x, height * y);
        context.scale(width * radiusX, height * radiusY);

        const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = gradient;
        context.fillRect(-1, -1, 2, 2);
        context.restore();
    }

    function drawAuroraLine(context, width, height, color, points) {
        context.save();
        context.beginPath();
        context.moveTo(points[0] * width, points[1] * height);
        context.bezierCurveTo(
            points[2] * width,
            points[3] * height,
            points[4] * width,
            points[5] * height,
            points[6] * width,
            points[7] * height
        );
        context.strokeStyle = color;
        context.lineCap = "round";
        context.lineWidth = 5;
        context.globalAlpha = 0.28;
        context.shadowColor = color;
        context.shadowBlur = 18;
        context.stroke();

        context.globalAlpha = 0.82;
        context.lineWidth = 1.15;
        context.shadowBlur = 7;
        context.strokeStyle = "rgba(248, 254, 255, 0.86)";
        context.stroke();
        context.restore();
    }

    function drawAuroraSource() {
        const width = source.width;
        const height = source.height;
        const styles = getComputedStyle(root);
        const isDark = root.dataset.theme !== "light";
        const colors = {
            base: cssColor(styles, "--bg", "#020713"),
            cyan: cssColor(styles, "--aurora-cyan", "rgba(18, 220, 255, 0.74)"),
            green: cssColor(styles, "--aurora-green", "rgba(82, 255, 145, 0.6)"),
            yellow: cssColor(styles, "--aurora-yellow", "rgba(255, 222, 79, 0.5)"),
            pink: cssColor(styles, "--aurora-pink", "rgba(255, 54, 179, 0.66)"),
            violet: cssColor(styles, "--aurora-violet", "rgba(127, 79, 255, 0.72)"),
            blue: cssColor(styles, "--aurora-blue", "rgba(31, 91, 255, 0.62)"),
        };

        sourceContext.setTransform(1, 0, 0, 1, 0, 0);
        sourceContext.globalAlpha = 1;
        sourceContext.globalCompositeOperation = "source-over";
        sourceContext.fillStyle = colors.base;
        sourceContext.fillRect(0, 0, width, height);
        sourceContext.globalCompositeOperation = isDark ? "screen" : "source-over";

        drawEllipticalGlow(sourceContext, width, height, 0.03, 0.09, 0.58, 0.44, colors.cyan);
        drawEllipticalGlow(sourceContext, width, height, 0.94, 0.12, 0.54, 0.42, colors.violet);
        drawEllipticalGlow(sourceContext, width, height, 0.18, 0.91, 0.52, 0.48, colors.green);
        drawEllipticalGlow(sourceContext, width, height, 0.88, 0.88, 0.48, 0.43, colors.pink);
        drawEllipticalGlow(sourceContext, width, height, 0.52, 0.52, 0.42, 0.35, colors.yellow);
        drawEllipticalGlow(sourceContext, width, height, 0.56, 0.2, 0.46, 0.38, colors.blue);

        sourceContext.globalCompositeOperation = isDark ? "screen" : "multiply";
        drawAuroraLine(sourceContext, width, height, colors.cyan, [-0.08, 0.19, 0.25, -0.03, 0.7, 0.45, 1.08, 0.1]);
        drawAuroraLine(sourceContext, width, height, colors.violet, [-0.08, 0.47, 0.28, 0.14, 0.68, 0.72, 1.08, 0.34]);
        drawAuroraLine(sourceContext, width, height, colors.pink, [-0.08, 0.73, 0.31, 0.38, 0.68, 0.98, 1.08, 0.57]);
        drawAuroraLine(sourceContext, width, height, colors.green, [-0.08, 0.94, 0.3, 0.63, 0.73, 1.08, 1.08, 0.78]);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        sourceNeedsUpdate = false;
    }

    function resizeCanvas() {
        const width = Math.max(1, Math.round(window.innerWidth));
        const height = Math.max(1, Math.round(window.innerHeight));

        if (stage.width === width && stage.height === height) {
            return false;
        }

        stage.width = width;
        stage.height = height;
        source.width = width;
        source.height = height;
        sourceNeedsUpdate = true;
        return true;
    }

    function drawScene() {
        renderFrame = 0;

        if (contextLost || document.hidden) {
            return;
        }

        resizeCanvas();

        if (sourceNeedsUpdate) {
            drawAuroraSource();
        }

        const width = stage.width;
        const height = stage.height;
        const elapsed = (performance.now() - startTime) / 1000;

        gl.viewport(0, 0, width, height);
        gl.disable(gl.SCISSOR_TEST);
        gl.useProgram(program);
        gl.uniform3f(uniforms.resolution, width, height, 1);
        gl.uniform1f(uniforms.time, elapsed);
        gl.uniform1f(uniforms.renderMode, 0);
        gl.uniform4f(uniforms.panel, 0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(uniforms.texture, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.enable(gl.SCISSOR_TEST);
        gl.uniform1f(uniforms.renderMode, 1);
        root.classList.add("shader-glass-enabled");

        surfaces.forEach((surface) => {
            const rect = surface.getBoundingClientRect();

            if (
                rect.width < 2 ||
                rect.height < 2 ||
                rect.right <= 0 ||
                rect.left >= width ||
                rect.bottom <= 0 ||
                rect.top >= height
            ) {
                return;
            }

            const left = rect.left;
            const bottom = height - rect.bottom;
            const panelWidth = Math.max(1, rect.width);
            const panelHeight = Math.max(1, rect.height);
            const scissorLeft = Math.max(0, Math.floor(left));
            const scissorBottom = Math.max(0, Math.floor(bottom));
            const scissorRight = Math.min(width, Math.ceil(left + panelWidth));
            const scissorTop = Math.min(height, Math.ceil(bottom + panelHeight));

            if (scissorRight <= scissorLeft || scissorTop <= scissorBottom) {
                return;
            }

            gl.scissor(
                scissorLeft,
                scissorBottom,
                scissorRight - scissorLeft,
                scissorTop - scissorBottom
            );
            gl.uniform4f(uniforms.panel, left, bottom, panelWidth, panelHeight);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });

        gl.disable(gl.SCISSOR_TEST);
    }

    function requestScene({ refreshSource = false } = {}) {
        if (contextLost) {
            return;
        }

        sourceNeedsUpdate ||= refreshSource;

        if (!renderFrame) {
            renderFrame = window.requestAnimationFrame(drawScene);
        }
    }

    const resizeObserver = "ResizeObserver" in window
        ? new ResizeObserver(() => requestScene())
        : null;

    surfaces.forEach((surface) => resizeObserver?.observe(surface));

    const themeObserver = new MutationObserver(() => requestScene({ refreshSource: true }));
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    function disableShaderGlass() {
        contextLost = true;

        if (renderFrame) {
            window.cancelAnimationFrame(renderFrame);
            renderFrame = 0;
        }

        resizeObserver?.disconnect();
        themeObserver.disconnect();
        root.classList.remove("shader-glass-enabled");
        stage.remove();
    }

    window.addEventListener("scroll", () => requestScene(), { passive: true });
    window.addEventListener("resize", () => requestScene({ refreshSource: true }), { passive: true });
    window.addEventListener("orientationchange", () => requestScene({ refreshSource: true }), { passive: true });
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            requestScene({ refreshSource: true });
        }
    });

    stage.addEventListener("webglcontextlost", () => {
        disableShaderGlass();
    });

    [transparencyQuery, contrastQuery, forcedColorsQuery].forEach((query) => {
        query.addEventListener?.("change", (event) => {
            if (event.matches) {
                disableShaderGlass();
            }
        });
    });

    document.fonts?.ready.then(() => requestScene());
    requestScene({ refreshSource: true });
})();
