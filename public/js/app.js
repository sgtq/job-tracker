import { fetchJobsData, triggerGitHubWorkflow } from "./api.js";

let allJobs = [];

const els = {
    get syncBtn() {
        return document.getElementById("sync-btn");
    },
    get settingsToggleBtn() {
        return document.getElementById("settings-toggle-btn");
    },
    get settingsPanel() {
        return document.getElementById("settings-panel");
    },
    get saveSettingsBtn() {
        return document.getElementById("save-settings-btn");
    },
    get closeSettingsBtn() {
        return document.getElementById("close-settings-btn");
    },
    get searchInput() {
        return document.getElementById("search-input");
    },
    get companyFilter() {
        return document.getElementById("company-filter");
    },
    get locationFilter() {
        return document.getElementById("location-filter");
    },
    get jobListContainer() {
        return document.getElementById("job-list-container");
    },
    get jobCount() {
        return document.getElementById("job-count");
    },
    get lastUpdatedBadge() {
        return document.getElementById("last-updated-badge");
    },
    get errorContainer() {
        return document.getElementById("global-error-container");
    },
    get ownerInput() {
        return document.getElementById("gh-owner");
    },
    get repoInput() {
        return document.getElementById("gh-repo");
    },
    get tokenInput() {
        return document.getElementById("gh-token");
    },
};

document.addEventListener("DOMContentLoaded", () => {
    try {
        initApp();
    } catch (err) {
        console.error("Critical initialization failure:", err);
    }
});

async function initApp() {
    loadStoredCredentials();
    initEventListeners();
    await loadJobs();
}

function initEventListeners() {
    if (els.syncBtn) els.syncBtn.addEventListener("click", handleSync);
    if (els.settingsToggleBtn)
        els.settingsToggleBtn.addEventListener("click", () => els.settingsPanel?.classList.toggle("hidden"));
    if (els.closeSettingsBtn)
        els.closeSettingsBtn.addEventListener("click", () => els.settingsPanel?.classList.add("hidden"));
    if (els.saveSettingsBtn) els.saveSettingsBtn.addEventListener("click", saveCredentials);

    if (els.searchInput) els.searchInput.addEventListener("input", applyFilters);
    if (els.companyFilter) els.companyFilter.addEventListener("change", applyFilters);
    if (els.locationFilter) els.locationFilter.addEventListener("change", applyFilters);
}

function loadStoredCredentials() {
    if (els.ownerInput) els.ownerInput.value = localStorage.getItem("gh_owner") || "";
    if (els.repoInput) els.repoInput.value = localStorage.getItem("gh_repo") || "";
    if (els.tokenInput) els.tokenInput.value = localStorage.getItem("gh_token") || "";
}

function saveCredentials() {
    if (els.ownerInput) localStorage.setItem("gh_owner", els.ownerInput.value.trim());
    if (els.repoInput) localStorage.setItem("gh_repo", els.repoInput.value.trim());
    if (els.tokenInput) localStorage.setItem("gh_token", els.tokenInput.value.trim());
    if (els.settingsPanel) els.settingsPanel.classList.add("hidden");
    alert("GitHub credentials saved successfully!");
}

function getGitHubConfig() {
    return {
        owner: localStorage.getItem("gh_owner"),
        repo: localStorage.getItem("gh_repo"),
        token: localStorage.getItem("gh_token"),
    };
}

async function loadJobs() {
    try {
        if (els.errorContainer) els.errorContainer.innerHTML = "";
        const rawData = await fetchJobsData();

        allJobs = Array.isArray(rawData) ? rawData : rawData.jobs || rawData.data || [];
        console.log("Loaded jobs raw count:", allJobs.length);

        populateFilterDropdowns(allJobs);
        renderJobs(allJobs);
        updateTimestamp();
    } catch (err) {
        console.error("Failed to load jobs:", err);
        if (els.errorContainer) {
            els.errorContainer.innerHTML = `
        <div style="background:#fee2e2;color:#991b1b;padding:0.75rem;border-radius:6px;margin-bottom:1rem;">
          Failed to load jobs.json. Make sure the scraper has run successfully.
        </div>
      `;
        }
    }
}

function populateFilterDropdowns(jobs) {
    if (!els.companyFilter || !els.locationFilter) return;

    const companies = new Set();
    const locations = new Set();

    jobs.forEach((job) => {
        const comp = job.company || job.companyName || job.organization;
        const loc = job.location || job.loc || job.city;
        if (comp) companies.add(comp);
        if (loc) locations.add(loc);
    });

    els.companyFilter.innerHTML =
        '<option value="">All Companies</option>' +
        Array.from(companies)
            .sort()
            .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
            .join("");

    els.locationFilter.innerHTML =
        '<option value="">All Locations</option>' +
        Array.from(locations)
            .sort()
            .map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`)
            .join("");
}

function renderJobs(jobs) {
    if (els.jobCount) els.jobCount.textContent = `${jobs.length} jobs found`;
    if (!els.jobListContainer) return;

    if (jobs.length === 0) {
        els.jobListContainer.innerHTML = `
      <p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">
        No matching jobs found.
      </p>
    `;
        return;
    }

    els.jobListContainer.innerHTML = jobs
        .map((job) => {
            const title = job.title || job.positionTitle || job.name || job.position || "Untitled Position";
            const company = job.company || job.companyName || job.organization || "Unknown Company";
            const location = job.location || job.loc || job.city || "Remote";
            const url = job.url || job.link || job.applyUrl || "#";

            const isRecent = job.dateAdded && Date.now() - new Date(job.dateAdded).getTime() < 48 * 60 * 60 * 1000;

            return `
      <div class="job-card">
        <div>
          <h3>
            ${escapeHtml(title)} 
            ${isRecent ? '<span class="badge-new">NEW</span>' : ""}
          </h3>
          <p class="job-meta">${escapeHtml(company)} &bull; ${escapeHtml(location)}</p>
        </div>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="job-link">View Position &rarr;</a>
      </div>
    `;
        })
        .join("");
}

function applyFilters() {
    const query = els.searchInput ? els.searchInput.value.toLowerCase() : "";
    const selectedCompany = els.companyFilter ? els.companyFilter.value : "";
    const selectedLocation = els.locationFilter ? els.locationFilter.value : "";

    const filtered = allJobs.filter((job) => {
        const title = (job.title || job.positionTitle || job.name || job.position || "").toLowerCase();
        const company = job.company || job.companyName || job.organization || "";
        const location = job.location || job.loc || job.city || "";

        const matchesSearch =
            title.includes(query) || company.toLowerCase().includes(query) || location.toLowerCase().includes(query);
        const matchesCompany = !selectedCompany || company === selectedCompany;
        const matchesLocation = !selectedLocation || location === selectedLocation;

        return matchesSearch && matchesCompany && matchesLocation;
    });

    renderJobs(filtered);
}

function updateTimestamp() {
    if (!els.lastUpdatedBadge) return;
    const now = new Date();
    els.lastUpdatedBadge.textContent = `Last Updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

async function handleSync() {
    const gh = getGitHubConfig();
    if (!gh.owner || !gh.repo || !gh.token) {
        alert(
            "Please open 'Settings' and enter your GitHub Username, Repository Name, and Fine-grained PAT before syncing.",
        );
        els.settingsPanel?.classList.remove("hidden");
        return;
    }

    if (els.syncBtn) els.syncBtn.disabled = true;
    try {
        if (els.syncBtn) els.syncBtn.textContent = "Triggering Action...";
        await triggerGitHubWorkflow(gh, []);
        alert(
            "Workflow successfully triggered on GitHub! Please wait about 60 seconds for the action to scrape and GitHub Pages to redeploy, then reload the page.",
        );
    } catch (err) {
        alert(`Sync failed: ${err.message}`);
    } finally {
        if (els.syncBtn) {
            els.syncBtn.textContent = "↻ Sync Jobs";
            els.syncBtn.disabled = false;
        }
    }
}

function escapeHtml(str) {
    return String(str || "").replace(
        /[&<>'"]/g,
        (tag) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "'": "&#39;",
                '"': "&quot;",
            })[tag] || tag,
    );
}
