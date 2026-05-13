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
