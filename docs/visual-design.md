# Landscape and liquid glass

## Backgrounds

Generated using the built-in imagegen tool, with bb.png as the reference. The dark variant was generated from the finished light image to retain matching geography. These are synthetic photographic-style landscapes, not photographs of a documented location.

Project assets:
- assets/backgrounds/alpine-light.webp (1536 × 1024)
- assets/backgrounds/alpine-dark.webp (1536 × 1024)
- assets/backgrounds/alpine-light-small.webp (960 × 640)
- assets/backgrounds/alpine-dark-small.webp (960 × 640)

Only format conversion and responsive downsampling were performed after generation. Both HTML images and WebGL use the same centered cover framing. The existing bb.png is preserved.

### Light prompt

Use case: photorealistic-natural. Asset type: wide 3:2 high resolution website background, light mode. Input image: bb.png is a composition and landscape reference. Generate a NEW convincingly photographic alpine landscape inspired by this reference: still clear lake, evergreen forest framing both shores, layered rugged alpine peaks, delicate low valley mist. Preserve the general lake and mountain composition. Transform the scene into luminous early morning daylight, clean azure sky, soft peach-pink sunrise clouds, natural emerald and teal conifers, turquoise lake reflections, warm sunlight on realistic rock. Vibrant but restrained natural photographic colors, crisp real textures, atmospheric depth, subtle ripples, excellent dynamic range without HDR halos. Calm generous sky for a website backdrop, no busy foreground, no people, no buildings, no text or watermarks. No aurora in daylight, no magical rainbow, no illustration or CGI appearance. Return one landscape photograph.

### Dark prompt

Use case: lighting-weather. Asset type: photorealistic website background, dark mode, wide 3:2 landscape. Input image 1 is the exact daytime landscape to preserve; input image 2 (bb.png) is only an aurora color and nighttime atmosphere reference. Relight image 1 as a realistic clean moonlit alpine night photograph. Keep the same camera, mountain silhouette and position, forest shores, lake, and framing. Deep navy and blue-hour indigo sky with sparse subtle stars and a graceful physically plausible emerald and teal aurora curtain with faint violet edges; luminous yet restrained, no rainbow colors everywhere. Forests retain beautiful dark evergreen detail, mountain faces softly lit by moonlight, fine low valley mist, soft reflections of the aurora in still lake water. Clean vibrant cool colors with a very subtle trace of pink near distant horizon. Photographic texture and natural dynamic range. Background must feel dark, serene and dimensional without crushed black shadows. No daylight sun, no buildings, no people, no text, no watermark, no illustration or CGI. Return one image.

## Renderer provenance

Adapted from [prabinpebam/liquid-glass](https://github.com/prabinpebam/liquid-glass), pinned to commit [c900ced7e5f3e068234f99d3efc1d7882e181771](https://github.com/prabinpebam/liquid-glass/tree/c900ced7e5f3e068234f99d3efc1d7882e181771).

Source references: js/shaders.js (rounded-box SDF, quadratic edge refraction, RGB dispersion, frosting, offset inner shadows/glow), js/reflections.js (gradient perimeter reflections). The inspected revision has no license file; no license grant is inferred here.

The local glass-shaders.js adapts the shader to a single landscape texture and arbitrary DOM surface dimensions. It uses boundary normals instead of a direction from the rectangle center, a broad smooth curved bevel, and an optional 5×5 binomial-weighted frosting kernel. Corner radii exceed the optical rim width to keep refraction continuous around corners. Mipmapped, power-of-two WebGL textures reduce aliasing where the lens compresses fine landscape details. All panels now use zero frosting and zero tint, keeping the scenery clear throughout the glass. Red, green and blue follow separate refraction paths, as in the upstream renderer; separation fades smoothly to zero toward the panel center. CSS implements the perimeter reflection with a masked conic gradient.

The demo's interactive editor, image upload controls, grid, and perpetual render behavior are omitted. glass.js uses one shared WebGL context and copies each visible lens to its own decorative 2D canvas; page text and controls remain normal HTML. This preserves clipping, sticky positioning, focus, selection, and stacking. Nested controls use CSS glass so they do not incorrectly replace their parent panel with the landscape.

Refraction samples the landscape, not arbitrary DOM content behind an overlapping panel. If WebGL cannot initialize, upload its texture, or continue rendering, the site switches to a Canvas 2D refraction renderer. That renderer retains curved edge displacement and RGB separation, using the same clear material settings; it does not require CSS/SVG backdrop-filter support. CSS surfaces are the final fallback if image loading or Canvas pixel access is unavailable. Reduced transparency, increased contrast, and forced colors disable the renderer. Reduced motion disables the site's motion through its existing CSS and interaction preferences.

Render work is event-driven. WebGL has a 30 fps scheduling cap during scrolling/reveals, a 600,000-pixel per-surface cap, and a maximum 1.5 device-pixel ratio. Software refraction has a 15 fps scheduling cap and 120,000 pixels per surface; actual frame rate depends on the device. Its lens maps and separably blurred texture levels are cached, and its scene texture is limited to 1024 pixels wide. Offscreen canvases release their backing stores and software lens maps. Theme updates discard stale image decodes, and WebGL context loss switches to software refraction; restoration reinitializes GPU resources. The shared WebGL buffer preserves its contents until each surface copy is complete. There is no glass CDN dependency.

## Local preview

Open `index.html` directly, including through a `file:///…/index.html` address, or run `python3 -m http.server 8008` from the repository and open http://localhost:8008.

The renderer uses ordered deferred classic scripts because Chromium blocks local ES module imports. On `file:` pages only, it also loads `assets/backgrounds/local-scenes.js`, which embeds the same WebP image bytes as data URLs. This makes the landscape safe to sample through Canvas and WebGL despite local-file origin restrictions. HTTP pages use the regular responsive image assets and never download this embedded copy. After changing the full-size landscape images, regenerate the local preview asset with `python3 scripts/build_local_scenes.py`. Direct-file previews keep the dated Scholar metrics snapshot in the HTML; fetching the local JSON update requires HTTP.


## Validation

Verified on September 14, 2026 in Firefox 153.0, Chromium 151.0.7922.34 and WebKit 26.5, opening `index.html` directly via `file:`. Each engine passed with WebGL enabled and with WebGL deliberately unavailable (Canvas 2D refraction). Checks cover light/dark rendering, saved theme after reload, publication-section scrolling, the 390px mobile layout without horizontal overflow, forced colors, and rendered-pixel comparisons proving edge displacement and RGB separation while the interior stays undistorted. No JavaScript errors occurred. Light, dark and mobile screenshots were saved and visually inspected. HTTP previews were also checked; earlier HTTP-only checks had missed the Chromium local-file module failure.

WebKit's Linux test runner required temporary shared libraries and a clean GTK environment; these test-environment changes are not part of the website. Testing WebKit does not certify every Safari version or device. The site content was preserved from the starting working copy.

## Panel materials

The CSS variables `--glass-thickness`, `--glass-refraction`, `--glass-chromatic`, `--glass-frost` and `--glass-opacity` are read directly by the renderer. Length parameters are in CSS pixels; chromatic amount is the maximum total red-to-blue displacement. Frost controls the 5×5 kernel extent (approximately half that amount as blur sigma in the interior), and tap spacing decreases toward the edge to preserve the lens detail. Tint is also weaker at the perimeter. CSS fallbacks use the same frost and opacity settings.

| Panel | Edge width | Refraction | RGB separation | Frost | Tint |
| --- | ---: | ---: | ---: | ---: | ---: |
| Navigation | 25 | 56 | 12 | 0 | 0 |
| Profile | 52 | 100 | 12 | 0 | 0 |
| Hero text | 48 | 86 | 10 | 0 | 0 |
| Section headings | 38 | 76 | 10 | 0 | 0 |
| Metrics | 34 | 70 | 12 | 0 | 0 |
| Experience, education, publications, skills | 34 | 68 | 9 | 0 | 0 |
| Footer | 26 | 54 | 10 | 0 | 0 |

Panel presets apply in both themes. Frost and tint inherit a shared zero default, including the software renderer. Nested metric tiles are also transparent. Text remains normal HTML with a localized contrasting shadow for legibility over the clear scenery; color separation only affects the background at glass boundaries.

Optics validation: rendered the actual shader against a synthetic grayscale texture and checked that enabling refraction changes edge pixels but not center pixels; enabling chromatic aberration separates edge RGB values but leaves center channels equal; and increasing frost reduces interior fine-detail contrast. Also inspected the updated light/dark screenshots.

## Repeatable browser checks

Install the development-only Playwright package and browser binaries, then run `python scripts/check_glass.py --browser all --protocol file --output /tmp/glass-file-checks`. Repeat with `--protocol http --output /tmp/glass-http-checks` to check serving over HTTP; that mode starts its own loopback-only server. Browser system libraries must also be available. The script tests Firefox, Chromium and WebKit both normally and with WebGL deliberately unavailable. It checks that the embedded scene asset loads only for direct-file previews, saves screenshots, and compares actual rendered lens pixels against chromatic/refraction-disabled renders on a synthetic grayscale background. Edge colors and displacement must change while the flat center stays unchanged. It also checks light/dark switching, persistence, scrolling, mobile overflow and forced colors.

WebKit automation exercises the WebKit engine, not every Safari/device release. Browser configurations that block JavaScript, image access or all Canvas drawing cannot show the optical renderer; accessibility modes intentionally use solid surfaces.
