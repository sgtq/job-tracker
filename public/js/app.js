import { getDomains, saveDomains, getGitHubConfig, saveGitHubConfig } from "./storage.js";
import { fetchJobsData, triggerGitHubWorkflow } from "./api.js";

let allJobs = [];
let domains = getDomains();

const els = {
    jobList: document.getElementById("jobList"),
    searchInput: document.getElementById("searchInput"),
    companyFilter: document.getElementById("companyFilter"),
    onlyNewFilter: document.getElementById("onlyNewFilter"),
    syncBtn: document.getElementById("syncBtn"),
    lastSynced: document.getElementById("lastSynced"),
    toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
    settingsPanel: document.getElementById("settingsPanel"),
    domainForm: document.getElementById("domainForm"),
    domainList: document.getElementById("domainList"),
    ghOwner: document.getElementById("ghOwner"),
    ghRepo: document.getElementById("ghRepo"),
    ghToken: document.getElementById("ghToken"),
    saveGhBtn: document.getElementById("saveGhBtn"),
    ghStatus: document.getElementById("ghStatus"),
};

function initSettings() {
    const gh = getGitHubConfig();
    els.ghOwner.value = gh.owner;
    els.ghRepo.value = gh.repo;
    els.ghToken.value = gh.token;
}

function renderDomains() {
    els.domainList.innerHTML = domains
        .map(
            (d, idx) => `
    <span class="domain-chip">
      <strong>${d.company}</strong> (${d.type})
      <button type="button" data-index="${idx}" title="Remove">×</button>
    </span>
  `,
        )
        .join("");

    els.domainList.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
            domains.splice(Number(btn.dataset.index), 1);
            saveDomains(domains);
            renderDomains();
        });
    });
}

function updateStats() {
    document.getElementById("totalCount").textContent = allJobs.length;
    document.getElementById("newCount").textContent = allJobs.filter((j) => j.is_new).length;
    document.getElementById("companyCount").textContent = new Set(allJobs.map((j) => j.company)).size;
}

function populateCompanyDropdown() {
    const current = els.companyFilter.value;
    const companies = [...new Set(allJobs.map((j) => j.company))].sort();
    els.companyFilter.innerHTML =
        `<option value="all">All Companies</option>` +
        companies.map((c) => `<option value="${c}">${c}</option>`).join("");
    if (companies.includes(current)) els.companyFilter.value = current;
}

function renderJobs() {
    const query = els.searchInput.value.toLowerCase().trim();
    const company = els.companyFilter.value;
    const onlyNew = els.onlyNewFilter.checked;

    const filtered = allJobs.filter((job) => {
        const matchesQuery = job.title.toLowerCase().includes(query) || job.company.toLowerCase().includes(query);
        const matchesCompany = company === "all" || job.company === company;
        const matchesNew = !onlyNew || job.is_new;
        return matchesQuery && matchesCompany && matchesNew;
    });

    if (filtered.length === 0) {
        els.jobList.innerHTML = `<div class="empty-state">No jobs match your current filters.</div>`;
        return;
    }

    els.jobList.innerHTML = filtered
        .map(
            (job) => `
    <article class="job-card">
      <div>
        <div class="job-meta">
          <span class="company-tag">${job.company}</span>
          <span>•</span>
          <span>Found ${job.date_found}</span>
          ${job.is_new ? '<span class="badge-new">NEW</span>' : ""}
        </div>
        <a href="${job.link}" target="_blank" rel="noopener noreferrer" class="job-title">${job.title}</a>
      </div>
      <a href="${job.link}" target="_blank" rel="noopener noreferrer">
        <button type="button">Apply ↗</button>
      </a>
    </article>
  `,
        )
        .join("");
}

async function loadJobs() {
    try {
        allJobs = await fetchJobsData();
        populateCompanyDropdown();
        updateStats();
        renderJobs();
        els.lastSynced.textContent = `Last synced: ${new Date().toLocaleTimeString()}`;
    } catch {
        els.jobList.innerHTML = `<div class="empty-state">No jobs data found yet. Run <code>npm start</code> or click Sync Jobs.</div>`;
    }
}

async function handleSync() {
    const gh = getGitHubConfig();

    // Validate credentials before attempting to trigger GitHub Actions
    if (!gh.owner || !gh.repo || !gh.token) {
        alert(
            "Please open 'Settings & Domains' and enter your GitHub Username, Repository Name, and Fine-grained PAT before syncing.",
        );
        els.settingsPanel.classList.remove("hidden"); // Automatically open settings
        return;
    }

    els.syncBtn.disabled = true;

    try {
        els.syncBtn.textContent = "Triggering GitHub Action...";
        await triggerGitHubWorkflow(gh, domains);
        els.lastSynced.textContent = "Workflow triggered! Waiting ~25s for new data...";

        // Wait for GitHub Actions to run and deploy the updated jobs.json
        await new Promise((r) => setTimeout(r, 25000));

        els.syncBtn.textContent = "Refreshing...";
        await loadJobs();
    } catch (err) {
        alert(`Sync failed: ${err.message}`);
    } finally {
        els.syncBtn.textContent = "↻ Sync Jobs";
        els.syncBtn.disabled = false;
    }
}

// Event Listeners
els.toggleSettingsBtn.addEventListener("click", () => els.settingsPanel.classList.toggle("hidden"));
els.syncBtn.addEventListener("click", handleSync);
els.searchInput.addEventListener("input", renderJobs);
els.companyFilter.addEventListener("change", renderJobs);
els.onlyNewFilter.addEventListener("change", renderJobs);

els.domainForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const company = document.getElementById("companyInput").value.trim();
    const rawUrl = document.getElementById("urlInput").value.trim();
    const type = document.getElementById("typeInput").value;

    const entry = type === "workday" ? { company, type, apiUrl: rawUrl } : { company, type, url: rawUrl };

    domains.push(entry);
    saveDomains(domains);
    renderDomains();
    els.domainForm.reset();
});

els.saveGhBtn.addEventListener("click", () => {
    saveGitHubConfig({
        owner: els.ghOwner.value.trim(),
        repo: els.ghRepo.value.trim(),
        token: els.ghToken.value.trim(),
    });
    els.ghStatus.textContent = "Credentials saved in browser storage.";
    setTimeout(() => (els.ghStatus.textContent = ""), 3000);
});

// Boot
initSettings();
renderDomains();
loadJobs();
