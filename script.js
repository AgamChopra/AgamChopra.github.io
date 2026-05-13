const year = document.getElementById("current-year");
const root = document.documentElement;
const themeToggle = document.getElementById("theme-toggle");
const scholarStatsPath = "scholar-stats.json";

if (year) {
    year.textContent = new Date().getFullYear();
}

function setTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";
    const isDark = nextTheme === "dark";
    const icon = themeToggle?.querySelector("i");
    const label = themeToggle?.querySelector("[data-theme-label]");

    root.dataset.theme = nextTheme;

    try {
        localStorage.setItem("theme", nextTheme);
    } catch (error) {
        console.warn(error);
    }

    if (themeToggle) {
        themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
    }

    if (icon) {
        icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    }

    if (label) {
        label.textContent = isDark ? "Light" : "Dark";
    }
}

themeToggle?.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
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

function initTopEasterEgg() {
    const revealDistance = 96;
    const popDistance = 340;
    const maxPullDistance = popDistance + 48;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const catGlyphs = ["\u{1F431}", "\u{1F408}", "\u{1F63A}", "\u{1F638}", "\u{1F63B}"];

    let pullDistance = 0;
    let isPopping = false;
    let resetTimer = 0;
    let lastTouchY = null;

    const egg = document.createElement("div");
    egg.className = "top-easter-egg";
    egg.setAttribute("aria-hidden", "true");

    const shell = document.createElement("span");
    shell.className = "top-easter-egg__shell";
    egg.append(shell);
    document.body.append(egg);

    function setEggProgress(progress) {
        const easedProgress = Math.min(Math.max(progress, 0), 1);

        egg.style.setProperty("--egg-offset", `${-34 + easedProgress * 38}px`);
        egg.style.setProperty("--egg-scale", `${0.78 + easedProgress * 0.28}`);
        egg.style.setProperty("--egg-tilt", `${(easedProgress - 0.5) * 10}deg`);
    }

    function resetEgg(delay = 360) {
        window.clearTimeout(resetTimer);

        resetTimer = window.setTimeout(() => {
            if (isPopping) {
                return;
            }

            pullDistance = 0;
            setEggProgress(0);
            egg.classList.remove("is-visible", "is-strained");
        }, delay);
    }

    function getSnapTarget() {
        const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;

        return Math.max(0, Math.min(maxScrollTop, Math.max(240, window.innerHeight * 0.42)));
    }

    function clearCatLayer(layer) {
        window.setTimeout(() => {
            layer.remove();
        }, reducedMotionQuery.matches ? 1400 : 4200);
    }

    function launchCats() {
        const layer = document.createElement("div");
        const catCount = reducedMotionQuery.matches ? 14 : 46;

        layer.className = "cat-confetti-layer";
        layer.setAttribute("aria-hidden", "true");
        document.body.append(layer);

        for (let index = 0; index < catCount; index += 1) {
            const cat = document.createElement("span");
            const drift = Math.round((Math.random() - 0.5) * 260);
            const spin = Math.round((Math.random() - 0.5) * 760);

            cat.className = "falling-cat";
            cat.textContent = catGlyphs[Math.floor(Math.random() * catGlyphs.length)];
            cat.style.setProperty("--left", `${Math.random() * 100}vw`);
            cat.style.setProperty("--delay", `${Math.random() * 0.42}s`);
            cat.style.setProperty("--duration", `${1.7 + Math.random() * 1.7}s`);
            cat.style.setProperty("--drift", `${drift}px`);
            cat.style.setProperty("--spin", `${spin}deg`);
            cat.style.setProperty("--size", `${24 + Math.random() * 28}px`);
            layer.append(cat);
        }

        clearCatLayer(layer);
    }

    function popEgg() {
        if (isPopping) {
            return;
        }

        isPopping = true;
        pullDistance = popDistance;
        setEggProgress(1);
        egg.classList.add("is-visible", "is-popped");
        launchCats();

        window.setTimeout(() => {
            window.scrollTo({
                top: getSnapTarget(),
                behavior: reducedMotionQuery.matches ? "auto" : "smooth",
            });
        }, 90);

        window.setTimeout(() => {
            pullDistance = 0;
            isPopping = false;
            setEggProgress(0);
            egg.classList.remove("is-visible", "is-strained", "is-popped");
        }, reducedMotionQuery.matches ? 900 : 1600);
    }

    function addPull(distance) {
        if (isPopping || window.scrollY > 2) {
            return;
        }

        window.clearTimeout(resetTimer);
        pullDistance = Math.min(maxPullDistance, pullDistance + distance);
        setEggProgress(pullDistance / popDistance);
        egg.classList.toggle("is-visible", pullDistance >= revealDistance);
        egg.classList.toggle("is-strained", pullDistance >= revealDistance * 1.8);

        if (pullDistance >= popDistance) {
            popEgg();
        } else {
            resetEgg(900);
        }
    }

    window.addEventListener(
        "wheel",
        (event) => {
            if (event.deltaY < 0 && window.scrollY <= 2) {
                addPull(Math.min(Math.abs(event.deltaY) * 0.45, 24));
            } else if (event.deltaY > 0) {
                resetEgg(80);
            }
        },
        { passive: true }
    );

    window.addEventListener(
        "touchstart",
        (event) => {
            lastTouchY = event.touches.length === 1 ? event.touches[0].clientY : null;
        },
        { passive: true }
    );

    window.addEventListener(
        "touchmove",
        (event) => {
            if (lastTouchY === null || event.touches.length !== 1) {
                return;
            }

            const nextTouchY = event.touches[0].clientY;
            const pullDelta = nextTouchY - lastTouchY;
            lastTouchY = nextTouchY;

            if (pullDelta > 0 && window.scrollY <= 2) {
                addPull(Math.min(pullDelta * 0.7, 24));
            }
        },
        { passive: true }
    );

    window.addEventListener(
        "touchend",
        () => {
            lastTouchY = null;
            resetEgg(650);
        },
        { passive: true }
    );

    window.addEventListener(
        "scroll",
        () => {
            if (window.scrollY > 4) {
                resetEgg(120);
            }
        },
        { passive: true }
    );
}

initTopEasterEgg();
