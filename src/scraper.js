// src/scraper.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const { targetUrls, keywords, dataFile } = require("./config");

const resolvedDataPath = path.resolve(process.cwd(), dataFile);

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

async function scrape() {
    const existingJobs = loadExistingJobs();
    const existingLinks = new Set(existingJobs.map((job) => job.link));
    const newJobsFound = [];

    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    for (const target of targetUrls) {
        try {
            console.log(`Scraping ${target.company}...`);
            const res = await axios.get(target.url, { headers, timeout: 15000 });
            const $ = cheerio.load(res.data);

            $("a").each((_, element) => {
                const a = $(element);
                const title = a.text().replace(/\s+/g, " ").trim();
                let href = a.attr("href");

                if (!href) return;

                // Resolve relative links
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
                            title: title,
                            link: href,
                            date_found: new Date().toISOString().split("T")[0],
                            is_new: true,
                        });
                    }
                }
            });
        } catch (e) {
            console.error(`Error scraping ${target.company}: ${e.message}`);
        }
    }

    if (newJobsFound.length > 0) {
        existingJobs.forEach((job) => (job.is_new = false));
        const updatedJobs = [...newJobsFound, ...existingJobs];

        // Ensure directory exists before writing
        fs.mkdirSync(path.dirname(resolvedDataPath), { recursive: true });
        fs.writeFileSync(resolvedDataPath, JSON.stringify(updatedJobs, null, 2), "utf-8");
        console.log(`Success: Added ${newJobsFound.length} new jobs.`);
    } else {
        console.log("No new jobs found.");
    }
}

scrape();
