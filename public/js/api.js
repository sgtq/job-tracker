export async function fetchJobsData() {
    const url = new URL("jobs.json", window.location.href);
    url.searchParams.set("t", Date.now()); // Bypass browser & CDN cache

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`jobs.json not found (Status: ${res.status})`);
    return res.json();
}

export async function triggerGitHubWorkflow({ owner, repo, token }, customDomains) {
    const endpoint = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/dispatches`;
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            ref: "main",
            inputs: {
                custom_targets: JSON.stringify(customDomains || []),
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub API error (${res.status}): ${errText}`);
    }
}
