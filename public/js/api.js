export async function fetchJobsData() {
    const res = await fetch(`./jobs.json?t=${Date.now()}`);
    if (!res.ok) throw new Error("jobs.json not found");
    return res.json();
}

export async function triggerGitHubWorkflow({ owner, repo, token }, customDomains) {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/dispatches`;
    const res = await fetch(url, {
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
                custom_targets: JSON.stringify(customDomains),
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub API error (${res.status}): ${errText}`);
    }
}
