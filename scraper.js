const puppeteer = require('puppeteer');

/**
 * Scrapes Facebook Reel descriptions for an array of URLs.
 * @param {string[]} urls Array of Facebook Reel URLs
 * @param {function} onProgress Callback function(data) called when each reel finishes
 * @returns {Promise<Array<{url: string, index: number, description: string, status: string}>>}
 */
async function scrapeReelDescriptions(urls, onProgress = () => {}) {
    console.log(`Starting batch scrape for ${urls.length} reels...`);
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--disable-notifications',
                '--mute-audio',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage'
            ]
        });
    } catch (err) {
        console.error("Failed to launch Puppeteer browser:", err);
        throw err;
    }

    const results = [];

    try {
        const page = await browser.newPage();
        
        // Set User-Agent to avoid immediate block
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i].trim();
            if (!url) continue;

            let itemResult = {
                index: i + 1,
                url: url,
                description: '',
                status: 'error'
            };

            try {
                // Navigate to URL with a reasonable timeout
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

                // Wait 1.5s for dynamic meta content to be injected if needed
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Extract description from meta tag or og:description tag
                const description = await page.evaluate(() => {
                    const metaDesc = document.querySelector('meta[name="description"]');
                    if (metaDesc && metaDesc.content && metaDesc.content.trim()) {
                        return metaDesc.content.trim();
                    }
                    const ogDesc = document.querySelector('meta[property="og:description"]');
                    if (ogDesc && ogDesc.content && ogDesc.content.trim()) {
                        return ogDesc.content.trim();
                    }
                    return "Description not found.";
                });

                itemResult.description = description;
                itemResult.status = description !== "Description not found." ? 'success' : 'warning';
            } catch (err) {
                console.error(`[Error] Failed to scrape Reel ${i + 1} (${url}):`, err.message);
                itemResult.description = `Error: ${err.message || 'Failed to retrieve description.'}`;
                itemResult.status = 'error';
            }

            results.push(itemResult);

            // Send progress update to client
            onProgress({
                completed: i + 1,
                total: urls.length,
                current: itemResult
            });
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    return results;
}

module.exports = { scrapeReelDescriptions };
