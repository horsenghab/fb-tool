require('dotenv').config();
const express = require('express');
const path = require('path');
const { scrapeReelDescriptions } = require('./scraper');
const Groq = require('groq-sdk');

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

// AI enhance endpoint — generates 3 alternative descriptions via Groq
app.post('/api/ai-enhance', async (req, res) => {
    const { description } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'A non-empty description is required.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY environment variable is not set on the server.' });
    }

    try {
        const groq = new Groq({ apiKey });

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `You are a creative Khmer social media copywriter.
Given a video description, rewrite it into exactly 3 alternative engaging descriptions.

Rules:
- Keep the SAME core meaning and all key details (characters, numbers, prices, context).
- Make each alternative more catchy, dramatic, and click-worthy.
- Always write the alternatives in Khmer (ភាសាខ្មែរ), even if the original is in another language.
- Respond with ONLY a valid JSON array of exactly 3 strings. No explanation, no markdown, no extra text.
- Example: ["alternative 1", "alternative 2", "alternative 3"]`
                },
                {
                    role: 'user',
                    content: `Original description:\n${description}`
                }
            ],
            temperature: 0.8,
            response_format: { type: 'json_object' },
        });

        let text = completion.choices[0]?.message?.content?.trim() || '';

        // Parse — Groq may wrap in an object like { "alternatives": [...] }
        let parsed = JSON.parse(text);
        let suggestions;
        if (Array.isArray(parsed)) {
            suggestions = parsed;
        } else {
            // Find the first array value in the object
            suggestions = Object.values(parsed).find(v => Array.isArray(v));
        }

        if (!suggestions || suggestions.length < 3) {
            throw new Error('Unexpected response format from AI.');
        }

        return res.json({ suggestions: suggestions.slice(0, 3) });
    } catch (err) {
        console.error('AI enhance error:', err);
        return res.status(500).json({ error: err.message || 'Failed to generate AI suggestions.' });
    }
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 FB Reel Scraper UI running at: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
