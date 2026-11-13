import { fetchJobsData, triggerGitHubWorkflow } from "./api.js";

let allJobs = [];

const els = {
    syncBtn: document.getElementById("sync-btn"),
    settingsToggleBtn: document.getElementById("settings-toggle-btn"),
    settingsPanel: document.getElementById("settings-panel"),
    saveSettingsBtn: document.getElementById("save-settings-btn"),
    closeSettingsBtn: document.getElementById("close-settings-btn"),
    searchInput: document.getElementById("search-input"),
    jobListContainer: document.getElementById("job-list-container"),
    jobCount: document.getElementById("job-count"),
    lastUpdatedBadge: document.getElementById("last-updated-badge"),
    errorContainer: document.getElementById("global-error-container"),
    ownerInput: document.getElementById("gh-owner"),
    repoInput: document.getElementById("gh-repo"),
    tokenInput: document.getElementById("gh-token"),
};

// Protected entry point to guard against third-party extension crashes (e.g., h1-check.js)
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
    els.syncBtn.addEventListener("click", handleSync);
    els.settingsToggleBtn.addEventListener("click", () => els.settingsPanel.classList.toggle("hidden"));
    els.closeSettingsBtn.addEventListener("click", () => els.settingsPanel.classList.add("hidden"));
    els.saveSettingsBtn.addEventListener("click", saveCredentials);
    els.searchInput.addEventListener("input", (e) => filterAndRenderJobs(e.target.value));
}

function loadStoredCredentials() {
    els.ownerInput.value = localStorage.getItem("gh_owner") || "";
    els.repoInput.value = localStorage.getItem("gh_repo") || "";
    els.tokenInput.value = localStorage.getItem("gh_token") || "";
}

function saveCredentials() {
    localStorage.setItem("gh_owner", els.ownerInput.value.trim());
    localStorage.setItem("gh_repo", els.repoInput.value.trim());
    localStorage.setItem("gh_token", els.tokenInput.value.trim());
    els.settingsPanel.classList.add("hidden");
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
        els.errorContainer.innerHTML = "";
        const rawData = await fetchJobsData();

        // Robustly handle whether jobs.json is a plain array or a wrapped object
        allJobs = Array.isArray(rawData) ? rawData : rawData.jobs || rawData.data || [];

        renderJobs(allJobs);
        updateTimestamp();
    } catch (err) {
        console.error("Failed to load jobs:", err);
        els.errorContainer.innerHTML = `
      <div style="background:#fee2e2;color:#991b1b;padding:0.75rem;border-radius:6px;margin-bottom:1rem;">
        Failed to load jobs.json. Make sure the scraper has run successfully and pushed data.
      </div>
    `;
    }
}

function renderJobs(jobs) {
    els.jobCount.textContent = `${jobs.length} jobs found`;
    if (jobs.length === 0) {
        els.jobListContainer.innerHTML = `
      <p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">
        No jobs available.
      </p>
    `;
        return;
    }

    els.jobListContainer.innerHTML = jobs
        .map((job) => {
            // Check if the job was added within the last 48 hours
            const isRecent = job.dateAdded && Date.now() - new Date(job.dateAdded).getTime() < 48 * 60 * 60 * 1000;
            return `
      <div class="job-card">
        <div>
          <h3>
            ${escapeHtml(job.title || job.positionTitle || "Untitled")} 
            ${isRecent ? '<span class="badge-new">NEW</span>' : ""}
          </h3>
          <p class="job-meta">${escapeHtml(job.company || "Unknown")} &bull; ${escapeHtml(job.location || "Remote")}</p>
        </div>
        <a href="${job.url || "#"}" target="_blank" rel="noopener" class="job-link">View Position &rarr;</a>
      </div>
    `;
        })
        .join("");
}

function filterAndRenderJobs(query) {
    const q = query.toLowerCase();
    const filtered = allJobs.filter(
        (j) =>
            (j.title || j.positionTitle || "").toLowerCase().includes(q) ||
            (j.company || "").toLowerCase().includes(q) ||
            (j.location || "").toLowerCase().includes(q),
    );
    renderJobs(filtered);
}

function updateTimestamp() {
    const now = new Date();
    els.lastUpdatedBadge.textContent = `Last Updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

async function handleSync() {
    const gh = getGitHubConfig();
    if (!gh.owner || !gh.repo || !gh.token) {
        alert(
            "Please open 'Settings' and enter your GitHub Username, Repository Name, and Fine-grained PAT before syncing.",
        );
        els.settingsPanel.classList.remove("hidden");
        return;
    }

    els.syncBtn.disabled = true;
    try {
        els.syncBtn.textContent = "Triggering Action...";
        await triggerGitHubWorkflow(gh, []);
        alert(
            "Workflow successfully triggered on GitHub! Please wait about 60 seconds for the action to scrape and GitHub Pages to redeploy, then reload the page.",
        );
    } catch (err) {
        alert(`Sync failed: ${err.message}`);
    } finally {
        els.syncBtn.textContent = "↻ Sync Jobs";
        els.syncBtn.disabled = false;
    }
}

function escapeHtml(str) {
    return String(str).replace(
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
