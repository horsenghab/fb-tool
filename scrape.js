const puppeteer = require('puppeteer');

async function getReelDescriptions(urls) {
    console.log("Launching browser...\n");
    
    // Launch a headless browser
    const browser = await puppeteer.launch({
        headless: true, // Set to false if you want to see the browser opening
        args: ['--disable-notifications', '--mute-audio']
    });
    
    const page = await browser.newPage();
    const descriptions = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
            // Navigate to the URL
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for a couple of seconds just to ensure dynamic elements settle (optional but helpful for FB)
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract the content from the <meta name="description"> tag
            const description = await page.evaluate(() => {
                const metaTag = document.querySelector('meta[name="description"]');
                return metaTag && metaTag.content ? metaTag.content : "Description not found.";
            });

            descriptions.push(description);
            console.log(`[Success] Reel ${i + 1}: ${url}`);
            
        } catch (error) {
            console.log(`[Error] Failed to scrape Reel ${i + 1}: ${url}`);
            descriptions.push("Error retrieving description.");
        }
    }

    console.log("\nClosing browser...\n");
    await browser.close();
    
    return descriptions;
}

// Your list of URLs
const reelUrls = [
    "https://www.facebook.com/reel/1038957305394787",
    "https://www.facebook.com/reel/1535332890927892",
    "https://www.facebook.com/reel/1569575578171978",
    "https://www.facebook.com/reel/1425847116031258",
    "https://www.facebook.com/reel/1346008321034128",
    "https://www.facebook.com/reel/2137476140187345",
    "https://www.facebook.com/reel/2823444421365331",
    "https://www.facebook.com/reel/1583246966780874",
    "https://www.facebook.com/reel/3111332822396869",
    "https://www.facebook.com/reel/1828292301474976",
    "https://www.facebook.com/reel/25591897480507833",
    "https://www.facebook.com/reel/1334358381745047"
];

// Execute the function
getReelDescriptions(reelUrls).then(results => {
    console.log("--- Final Results ---");
    results.forEach((desc, index) => {
        console.log(`\nReel ${index + 1} Description:\n${desc}`);
    });
});