const express = require('express');
const path = require('path');
const { scrapeReelDescriptions } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Root route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SSE streaming endpoint for live scraping progress
app.post('/api/scrape', async (req, res) => {
    const { urls } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of valid URLs.' });
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        sendEvent('start', { total: urls.length });

        await scrapeReelDescriptions(urls, (progress) => {
            sendEvent('progress', progress);
        });

        sendEvent('complete', { message: 'Scraping finished successfully.' });
    } catch (error) {
        console.error('Scraping stream error:', error);
        sendEvent('error', { message: error.message || 'An unexpected error occurred.' });
    } finally {
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 FB Reel Scraper UI running at: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
