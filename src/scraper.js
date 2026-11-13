// src/scraper.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const { targetUrls: defaultTargets, keywords, dataFile } = require("./config");

const resolvedDataPath = path.resolve(process.cwd(), dataFile);

function getTargets() {
    if (process.env.CUSTOM_TARGETS) {
        try {
            const parsed = JSON.parse(process.env.CUSTOM_TARGETS);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.warn("Invalid CUSTOM_TARGETS env var, falling back to src/config.js");
        }
    }
    return defaultTargets;
}

function loadExistingJobs() {
    if (fs.existsSync(resolvedDataPath)) {
        try {
            return JSON.parse(fs.readFileSync(resolvedDataPath, "utf-8"));
        } catch (e) {
            console.error("Error parsing existing jobs.json, starting fresh:", e.message);
        }
    }
    return [];
}

async function scrapeHtmlSite(target, existingLinks, newJobsFound) {
    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    const res = await axios.get(target.url, { headers, timeout: 15000 });
    const $ = cheerio.load(res.data);

    $("a").each((_, element) => {
        const a = $(element);
        const title = a.text().replace(/\s+/g, " ").trim();
        let href = a.attr("href");

        if (!href) return;

        if (href.startsWith("/")) {
            const urlObj = new URL(target.url);
            href = `${urlObj.protocol}//${urlObj.host}${href}`;
        }

        const lowerTitle = title.toLowerCase();
        const lowerHref = href.toLowerCase();

        if (title.length > 4 && keywords.some((k) => lowerTitle.includes(k) || lowerHref.includes(k))) {
            if (!existingLinks.has(href)) {
                existingLinks.add(href);
                newJobsFound.push({
                    company: target.company,
                    title,
                    link: href,
                    date_found: new Date().toISOString().split("T")[0],
                    is_new: true,
                });
            }
        }
    });
}

async function scrapeWorkdaySite(target, existingLinks, newJobsFound) {
    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        Accept: "application/json",
    };

    const payload = {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: "",
    };

    const response = await axios.post(target.apiUrl, payload, { headers, timeout: 15000 });
    const jobPostings = response.data.jobPostings || [];
    console.log(`Found ${jobPostings.length} postings from Workday.`);

    const urlObj = new URL(target.apiUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    for (const job of jobPostings) {
        const title = job.title;
        const link = `${baseUrl}${job.externalPath}`;
        const lowerTitle = title.toLowerCase();

        if (keywords.some((k) => lowerTitle.includes(k))) {
            if (!existingLinks.has(link)) {
                existingLinks.add(link);
                newJobsFound.push({
                    company: target.company,
                    title,
                    link,
                    date_found: new Date().toISOString().split("T")[0],
                    is_new: true,
                });
            }
        }
    }
}

async function runScraper() {
    const targets = getTargets();
    const existingJobs = loadExistingJobs();
    const existingLinks = new Set(existingJobs.map((job) => job.link));
    const newJobsFound = [];

    for (const target of targets) {
        try {
            console.log(`Processing ${target.company} (${target.type})...`);
            if (target.type === "workday") {
                await scrapeWorkdaySite(target, existingLinks, newJobsFound);
            } else if (target.type === "html") {
                await scrapeHtmlSite(target, existingLinks, newJobsFound);
            } else {
                console.warn(`Unknown scraper type "${target.type}" for ${target.company}`);
            }
        } catch (e) {
            console.error(`Error scraping ${target.company}: ${e.message}`);
        }
    }

    if (newJobsFound.length > 0) {
        existingJobs.forEach((job) => (job.is_new = false));
        const updatedJobs = [...newJobsFound, ...existingJobs];

        fs.mkdirSync(path.dirname(resolvedDataPath), { recursive: true });
        fs.writeFileSync(resolvedDataPath, JSON.stringify(updatedJobs, null, 2), "utf-8");
        console.log(`Success: Added ${newJobsFound.length} new jobs.`);
    } else {
        console.log("No new jobs found across targets.");
    }
}

runScraper();
