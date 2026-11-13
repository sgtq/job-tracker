const DOMAINS_KEY = "trackedDomains";
const GH_CONFIG_KEY = "ghSyncConfig";

const DEFAULT_DOMAINS = [
    {
        company: "GDT",
        type: "workday",
        apiUrl: "https://gdt.wd1.myworkdayjobs.com/wday/cxs/gdt/GDT_Careers/jobs",
    },
];

export function getDomains() {
    const raw = localStorage.getItem(DOMAINS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_DOMAINS;
}

export function saveDomains(domains) {
    localStorage.setItem(DOMAINS_KEY, JSON.stringify(domains));
}

export function getGitHubConfig() {
    const raw = localStorage.getItem(GH_CONFIG_KEY);
    return raw ? JSON.parse(raw) : { owner: "", repo: "", token: "" };
}

export function saveGitHubConfig(config) {
    localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(config));
}
