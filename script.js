const root = document.documentElement;
const body = document.body;
const year = document.getElementById("current-year");
const themeToggle = document.getElementById("theme-toggle");
const themeColor = document.getElementById("theme-color");
const siteHeader = document.querySelector(".site-header");
const scholarStatsPath = "scholar-stats.json";
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

if (year) {
    year.textContent = new Date().getFullYear();
}

function setTheme(theme, { animate = false } = {}) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    const isDark = nextTheme === "dark";
    const icon = themeToggle?.querySelector("i");
    const label = themeToggle?.querySelector("[data-theme-label]");

    root.dataset.theme = nextTheme;

    try {
        localStorage.setItem("theme", nextTheme);
    } catch (error) {
        console.warn(error);
    }

    if (themeColor) {
        themeColor.content = isDark ? "#020713" : "#e8f2f8";
    }

    if (themeToggle) {
        themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
        themeToggle.title = `Switch to ${isDark ? "light" : "dark"} theme`;
    }

    if (icon) {
        icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    }

    if (label) {
        label.textContent = isDark ? "Light" : "Dark";
    }

    if (animate && themeToggle && !reducedMotionQuery.matches) {
        themeToggle.classList.remove("is-changing");
        void themeToggle.offsetWidth;
        themeToggle.classList.add("is-changing");
        window.setTimeout(() => themeToggle.classList.remove("is-changing"), 560);
    }
}

themeToggle?.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark", { animate: true });
});

setTheme(root.dataset.theme);

function formatStatsDate(value) {
    const parsedDate = new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
        return "from Google Scholar";
    }

    return `updated ${parsedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    })}`;
}

async function loadScholarStats() {
    const hIndex = document.querySelector("[data-scholar-h-index]");
    const citations = document.querySelector("[data-scholar-citations]");
    const updated = document.querySelector("[data-scholar-updated]");

    if (!hIndex || !citations || !updated) {
        return;
    }

    try {
        const response = await fetch(`${scholarStatsPath}?v=${Date.now()}`, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Unable to load Scholar stats: ${response.status}`);
        }

        const stats = await response.json();
        const nextHIndex = Number(stats.h_index);
        const nextCitations = Number(stats.citations);

        if (!Number.isFinite(nextHIndex) || !Number.isFinite(nextCitations)) {
            throw new Error("Scholar stats JSON is missing numeric h_index or citations.");
        }

        hIndex.textContent = nextHIndex.toLocaleString("en-US");
        citations.textContent = nextCitations.toLocaleString("en-US");
        updated.textContent = formatStatsDate(stats.updated_at);
    } catch (error) {
        console.warn(error);
    }
}

loadScholarStats();

function initScrollChrome() {
    let frame = 0;

    function updateChrome() {
        frame = 0;

        const scrollY = Math.max(0, window.scrollY);
        const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, scrollY / scrollRange);

        root.style.setProperty("--scroll-progress", progress.toFixed(4));
    }

    function requestUpdate() {
        if (!frame) {
            frame = window.requestAnimationFrame(updateChrome);
        }
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    updateChrome();
}

function initActiveNavigation() {
    const sectionLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    const sections = sectionLinks
        .map((link) => document.querySelector(link.getAttribute("href")))
        .filter(Boolean);

    if (!sectionLinks.length || !sections.length || !("IntersectionObserver" in window)) {
        return;
    }

    function setActiveSection(id) {
        sectionLinks.forEach((link) => {
            if (link.getAttribute("href") === `#${id}`) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    const observer = new IntersectionObserver(
        (entries) => {
            const visibleEntry = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

            if (visibleEntry) {
                setActiveSection(visibleEntry.target.id);
            }
        },
        { rootMargin: "-24% 0px -62%", threshold: [0.01, 0.2, 0.5] }
    );

    sections.forEach((section) => observer.observe(section));
}

function initRevealMotion() {
    const revealTargets = Array.from(
        document.querySelectorAll(
            ".hero-copy, .hero-panel, .metrics, .section-intro, .timeline-item, .education-grid article, .publication-list li, .skill-groups article"
        )
    );

    if (!revealTargets.length || reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
        revealTargets.forEach((target) => target.classList.add("is-visible"));
        return;
    }

    root.classList.add("motion-enabled");

    revealTargets.forEach((target, index) => {
        target.classList.add("reveal-item");
        target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 45}ms`);
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        { rootMargin: "0px 0px -7%", threshold: 0.06 }
    );

    revealTargets.forEach((target) => observer.observe(target));

    reducedMotionQuery.addEventListener?.("change", (event) => {
        if (event.matches) {
            root.classList.remove("motion-enabled");
            revealTargets.forEach((target) => target.classList.add("is-visible"));
            observer.disconnect();
        }
    });
}

function initMomentumInteractions() {
    const pressTargets = Array.from(
        document.querySelectorAll(".button, .theme-toggle, .brand, .nav-links a, .footer-shell a")
    );
    const motionSurfaces = Array.from(
        document.querySelectorAll(
            ".hero-panel, .metrics > li, .timeline-item, .education-grid article, .publication-list li, .skill-groups article"
        )
    );
    const cleanupTimers = new WeakMap();
    const pointerFrames = new WeakMap();

    function releasePress(target) {
        if (!target.classList.contains("is-pressing")) {
            return;
        }

        target.classList.remove("is-pressing");
        target.classList.add("is-rebounding");
        window.clearTimeout(cleanupTimers.get(target));
        cleanupTimers.set(
            target,
            window.setTimeout(() => target.classList.remove("is-rebounding"), 500)
        );
    }

    pressTargets.forEach((target) => {
        target.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) {
                return;
            }

            target.classList.remove("is-rebounding");
            target.classList.add("is-pressing");
        });
        target.addEventListener("pointerup", () => releasePress(target));
        target.addEventListener("pointercancel", () => releasePress(target));
        target.addEventListener("pointerleave", () => releasePress(target));
    });

    const magneticControls = Array.from(document.querySelectorAll(".button"));

    magneticControls.forEach((control) => {
        control.addEventListener("pointermove", (event) => {
            if (!finePointerQuery.matches || reducedMotionQuery.matches) {
                return;
            }

            const rect = control.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;

            control.style.setProperty("--magnet-x", `${(x * 6).toFixed(2)}px`);
            control.style.setProperty("--magnet-y", `${(y * 4).toFixed(2)}px`);
        });

        control.addEventListener("pointerleave", () => {
            control.style.setProperty("--magnet-x", "0px");
            control.style.setProperty("--magnet-y", "0px");
        });
    });

    function resetSurface(surface) {
        const frame = pointerFrames.get(surface);

        if (frame) {
            window.cancelAnimationFrame(frame);
        }

        pointerFrames.delete(surface);
        surface.classList.remove("is-hovered", "is-pressing");
        surface.style.setProperty("--tilt-x", "0deg");
        surface.style.setProperty("--tilt-y", "0deg");
        surface.style.setProperty("--pointer-x", "50%");
        surface.style.setProperty("--pointer-y", "20%");
    }

    motionSurfaces.forEach((surface) => {
        surface.classList.add("motion-surface");

        surface.addEventListener("pointerenter", () => {
            if (finePointerQuery.matches && !reducedMotionQuery.matches) {
                surface.classList.add("is-hovered");
            }
        });

        surface.addEventListener("pointermove", (event) => {
            if (!finePointerQuery.matches || reducedMotionQuery.matches || pointerFrames.has(surface)) {
                return;
            }

            const clientX = event.clientX;
            const clientY = event.clientY;
            const frame = window.requestAnimationFrame(() => {
                pointerFrames.delete(surface);
                const rect = surface.getBoundingClientRect();
                const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
                const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

                surface.style.setProperty("--pointer-x", `${(x * 100).toFixed(1)}%`);
                surface.style.setProperty("--pointer-y", `${(y * 100).toFixed(1)}%`);
                surface.style.setProperty("--tilt-x", `${((0.5 - y) * 1.5).toFixed(2)}deg`);
                surface.style.setProperty("--tilt-y", `${((x - 0.5) * 1.8).toFixed(2)}deg`);
            });

            pointerFrames.set(surface, frame);
        });

        surface.addEventListener("pointerdown", (event) => {
            if (event.button === 0 && !reducedMotionQuery.matches) {
                surface.classList.add("is-pressing");
            }
        });
        surface.addEventListener("pointerup", () => surface.classList.remove("is-pressing"));
        surface.addEventListener("pointercancel", () => resetSurface(surface));
        surface.addEventListener("pointerleave", () => resetSurface(surface));
    });

    let ambientFrame = 0;
    let ambientX = 0;
    let ambientY = 0;

    window.addEventListener(
        "pointermove",
        (event) => {
            if (!finePointerQuery.matches || reducedMotionQuery.matches) {
                return;
            }

            ambientX = (event.clientX / window.innerWidth - 0.5) * 18;
            ambientY = (event.clientY / window.innerHeight - 0.5) * 14;

            if (!ambientFrame) {
                ambientFrame = window.requestAnimationFrame(() => {
                    ambientFrame = 0;
                    body.style.setProperty("--ambient-x", `${ambientX.toFixed(2)}px`);
                    body.style.setProperty("--ambient-y", `${ambientY.toFixed(2)}px`);
                    body.style.setProperty("--ambient-x-opposite", `${(-ambientX * 0.7).toFixed(2)}px`);
                    body.style.setProperty("--ambient-y-opposite", `${(-ambientY * 0.7).toFixed(2)}px`);
                });
            }
        },
        { passive: true }
    );
}

function initTopEasterEgg() {
    const trigger = document.querySelector("[data-easter-egg-trigger]");
    const status = document.getElementById("easter-egg-status");
    const touchThreshold = 154;
    const wheelThreshold = 220;
    const reducedDuration = 180;
    const normalDuration = 1320;
    let state = "idle";
    let progress = 0;
    let pendingProgress = 0;
    let pendingTilt = 0;
    let progressFrame = 0;
    let touchStartY = null;
    let touchStartX = null;
    let wheelPull = 0;
    let wheelSession = false;
    let wheelReleaseTimer = 0;
    let releaseTimer = 0;
    let cooldownTimer = 0;
    let activationCount = 0;
    let activationTimer = 0;
    let longPressTimer = 0;
    let longPressTriggered = false;

    const egg = document.createElement("div");
    egg.className = "top-easter-egg";
    egg.setAttribute("aria-hidden", "true");
    egg.innerHTML = `
        <span class="top-easter-egg__tether"></span>
        <span class="top-easter-egg__capsule">
            <span class="top-easter-egg__shine"></span>
            <span class="top-easter-egg__cat">😺</span>
            <span class="top-easter-egg__shell"><span class="top-easter-egg__crack"></span></span>
            <span class="top-easter-egg__fragment is-left"></span>
            <span class="top-easter-egg__fragment is-right"></span>
        </span>
        <span class="top-easter-egg__ring"></span>
        <span class="top-easter-egg__hint">Keep pulling</span>
    `;
    body.append(egg);

    const hint = egg.querySelector(".top-easter-egg__hint");

    function atPageTop() {
        return Math.max(0, window.scrollY) <= 2;
    }

    function updateAnchor() {
        const headerBottom = siteHeader?.getBoundingClientRect().bottom ?? 88;
        egg.style.setProperty("--egg-anchor", `${Math.max(72, Math.round(headerBottom - 8))}px`);
    }

    function applyProgress(nextProgress, tilt = 0) {
        progress = Math.min(1, Math.max(0, nextProgress));
        const visibleProgress = Math.max(0, (progress - 0.04) / 0.96);
        const y = -104 + visibleProgress * 116;
        const scaleX = 0.86 - progress * 0.08;
        const scaleY = 0.68 + progress * 0.48;

        egg.style.setProperty("--egg-progress", progress.toFixed(4));
        egg.style.setProperty("--egg-opacity", Math.min(1, visibleProgress * 1.35).toFixed(4));
        egg.style.setProperty("--egg-y", `${y.toFixed(2)}px`);
        egg.style.setProperty("--egg-scale-x", scaleX.toFixed(4));
        egg.style.setProperty("--egg-scale-y", scaleY.toFixed(4));
        egg.style.setProperty("--egg-tilt", `${Math.max(-8, Math.min(8, tilt)).toFixed(2)}deg`);
        egg.classList.toggle("is-pulling", progress > 0 && state === "pulling");
        egg.classList.toggle("is-armed", progress >= 1 && state === "pulling");

        if (hint) {
            hint.textContent = progress >= 1 ? "Release to hatch" : "Keep pulling";
        }
    }

    function setProgress(nextProgress, tilt = 0) {
        pendingProgress = nextProgress;
        pendingTilt = tilt;

        if (!progressFrame) {
            progressFrame = window.requestAnimationFrame(() => {
                progressFrame = 0;
                applyProgress(pendingProgress, pendingTilt);
            });
        }
    }

    function announce(message) {
        if (!status) {
            return;
        }

        status.textContent = "";
        window.setTimeout(() => {
            status.textContent = message;
        }, 20);
    }

    function launchParticles() {
        if (reducedMotionQuery.matches) {
            return;
        }

        document.querySelector(".egg-particle-layer")?.remove();

        const layer = document.createElement("div");
        const fragment = document.createDocumentFragment();
        const count = finePointerQuery.matches ? 14 : 8;
        const glyphs = ["🐾", "✦", "·", "😺"];
        const colors = ["#63d9ff", "#a98cff", "#ff9cdb", "#ffe67a"];
        const originY = Math.round((siteHeader?.getBoundingClientRect().bottom ?? 88) + 44);

        layer.className = "egg-particle-layer";
        layer.setAttribute("aria-hidden", "true");

        for (let index = 0; index < count; index += 1) {
            const particle = document.createElement("span");
            const direction = index % 2 === 0 ? 1 : -1;
            const spread = 34 + (index % 7) * 17;
            const burstX = direction * spread;
            const landingX = burstX + direction * (26 + (index % 4) * 18);
            const burstY = -(62 + (index % 5) * 18);
            const isSpark = index % 3 === 1;

            particle.className = `egg-particle${isSpark ? " is-spark" : ""}`;
            particle.textContent = isSpark ? "" : glyphs[index % glyphs.length];
            particle.style.setProperty("--origin-y", `${originY}px`);
            particle.style.setProperty("--burst-x", `${burstX}px`);
            particle.style.setProperty("--landing-x", `${landingX}px`);
            particle.style.setProperty("--burst-y", `${burstY}px`);
            particle.style.setProperty("--spin", `${direction * (260 + index * 37)}deg`);
            particle.style.setProperty("--particle-delay", `${(index % 4) * 28}ms`);
            particle.style.setProperty("--particle-duration", `${1.75 + (index % 5) * 0.12}s`);
            particle.style.setProperty("--particle-size", `${isSpark ? 7 + (index % 4) * 2 : 18 + (index % 4) * 3}px`);
            particle.style.setProperty("--particle-color", colors[index % colors.length]);
            fragment.append(particle);
        }

        layer.append(fragment);
        body.append(layer);

        const cleanup = () => layer.remove();
        layer.lastElementChild?.addEventListener("animationend", cleanup, { once: true });
        window.setTimeout(cleanup, 3200);
    }

    function resetToIdle() {
        state = "idle";
        wheelPull = 0;
        wheelSession = false;
        touchStartY = null;
        touchStartX = null;
        egg.classList.remove("is-pulling", "is-armed", "is-releasing", "is-hatching");
        applyProgress(0, 0);
    }

    function releaseEgg() {
        if (state !== "pulling") {
            return;
        }

        state = "releasing";
        egg.classList.remove("is-pulling", "is-armed");
        egg.classList.add("is-releasing");
        applyProgress(0, 0);
        window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(resetToIdle, reducedMotionQuery.matches ? 30 : 560);
    }

    function hatchEgg() {
        if (state === "hatching" || state === "cooldown") {
            return;
        }

        window.clearTimeout(wheelReleaseTimer);
        window.clearTimeout(releaseTimer);
        state = "hatching";
        wheelSession = false;
        wheelPull = 0;
        applyProgress(1, 0);
        egg.classList.remove("is-pulling", "is-armed", "is-releasing");
        egg.classList.add("is-hatching");
        body.classList.add("egg-impact");
        announce("You found the hidden cat hatch!");
        launchParticles();

        if (!reducedMotionQuery.matches && "vibrate" in navigator) {
            navigator.vibrate(18);
        }

        window.setTimeout(() => body.classList.remove("egg-impact"), 700);
        window.setTimeout(() => {
            egg.classList.remove("is-hatching");
            applyProgress(0, 0);
            state = "cooldown";
            window.clearTimeout(cooldownTimer);
            cooldownTimer = window.setTimeout(resetToIdle, 900);
        }, reducedMotionQuery.matches ? reducedDuration : normalDuration);
    }

    function beginPull() {
        if (state !== "idle" || !atPageTop()) {
            return false;
        }

        state = "pulling";
        egg.classList.remove("is-releasing");
        return true;
    }

    function normalizeWheelDelta(event) {
        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            return event.deltaY * 16;
        }

        if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
            return event.deltaY * window.innerHeight;
        }

        return event.deltaY;
    }

    window.addEventListener(
        "wheel",
        (event) => {
            if (event.ctrlKey || state === "hatching" || state === "cooldown") {
                return;
            }

            const delta = normalizeWheelDelta(event);

            if (!wheelSession) {
                if (delta >= 0 || !atPageTop() || !beginPull()) {
                    return;
                }

                wheelSession = true;
                wheelPull = 0;
            }

            if (!atPageTop()) {
                wheelSession = false;
                releaseEgg();
                return;
            }

            if (delta < 0) {
                wheelPull += Math.min(Math.abs(delta), 46);
            } else {
                wheelPull = Math.max(0, wheelPull - Math.min(delta, 60));
            }

            setProgress(wheelPull / wheelThreshold, Math.sin(wheelPull / 28) * 2.2);
            window.clearTimeout(wheelReleaseTimer);
            wheelReleaseTimer = window.setTimeout(() => {
                wheelSession = false;

                if (progress >= 1 || wheelPull >= wheelThreshold) {
                    hatchEgg();
                } else {
                    releaseEgg();
                }
            }, 130);
        },
        { passive: true }
    );

    window.addEventListener(
        "touchstart",
        (event) => {
            if (event.touches.length !== 1 || state !== "idle" || !atPageTop()) {
                return;
            }

            touchStartY = event.touches[0].clientY;
            touchStartX = event.touches[0].clientX;
            beginPull();
        },
        { passive: true }
    );

    window.addEventListener(
        "touchmove",
        (event) => {
            if (state !== "pulling" || touchStartY === null || touchStartX === null || event.touches.length !== 1) {
                return;
            }

            const touch = event.touches[0];
            const displacement = Math.max(0, touch.clientY - touchStartY);
            const horizontalDisplacement = touch.clientX - touchStartX;
            setProgress(displacement / touchThreshold, horizontalDisplacement / 18);
        },
        { passive: true }
    );

    function finishTouch() {
        if (state !== "pulling") {
            touchStartY = null;
            touchStartX = null;
            return;
        }

        const shouldHatch = progress >= 1 || pendingProgress >= 1;
        touchStartY = null;
        touchStartX = null;

        if (shouldHatch) {
            hatchEgg();
        } else {
            releaseEgg();
        }
    }

    window.addEventListener("touchend", finishTouch, { passive: true });
    window.addEventListener("touchcancel", finishTouch, { passive: true });

    trigger?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || state === "hatching" || state === "cooldown") {
            return;
        }

        longPressTriggered = false;
        window.clearTimeout(longPressTimer);
        longPressTimer = window.setTimeout(() => {
            longPressTriggered = true;
            hatchEgg();
        }, 720);
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
        trigger?.addEventListener(eventName, () => window.clearTimeout(longPressTimer));
    });

    trigger?.addEventListener("click", (event) => {
        if (longPressTriggered) {
            event.preventDefault();
            longPressTriggered = false;
            return;
        }

        activationCount += 1;
        window.clearTimeout(activationTimer);
        activationTimer = window.setTimeout(() => {
            activationCount = 0;
        }, 900);

        if (activationCount >= 3) {
            event.preventDefault();
            activationCount = 0;
            hatchEgg();
        }
    });

    function cancelInteraction() {
        window.clearTimeout(wheelReleaseTimer);
        window.clearTimeout(releaseTimer);
        window.clearTimeout(longPressTimer);

        if (progressFrame) {
            window.cancelAnimationFrame(progressFrame);
            progressFrame = 0;
        }

        if (state === "pulling" || state === "releasing") {
            resetToIdle();
        }
    }

    window.addEventListener("resize", updateAnchor, { passive: true });
    window.addEventListener("blur", cancelInteraction);
    window.addEventListener("pagehide", cancelInteraction);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            cancelInteraction();
        }
    });
    reducedMotionQuery.addEventListener?.("change", cancelInteraction);

    updateAnchor();
    applyProgress(0, 0);
}

initScrollChrome();
initActiveNavigation();
initRevealMotion();
initMomentumInteractions();
initTopEasterEgg();
