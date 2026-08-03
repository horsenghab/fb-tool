document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const urlCountBadge = document.getElementById('urlCountBadge');
    const btnSample = document.getElementById('btnSample');
    const btnClear = document.getElementById('btnClear');
    const btnScrape = document.getElementById('btnScrape');
    const btnScrapeText = document.getElementById('btnScrapeText');
    const btnCopyAll = document.getElementById('btnCopyAll');
    const btnCopyAllText = document.getElementById('btnCopyAllText');

    const progressSection = document.getElementById('progressSection');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const progressBarFill = document.getElementById('progressBarFill');

    const statsSummary = document.getElementById('statsSummary');
    const statTotal = document.getElementById('statTotal');
    const statSuccess = document.getElementById('statSuccess');
    const statFailed = document.getElementById('statFailed');

    const resultsList = document.getElementById('resultsList');
    const emptyState = document.getElementById('emptyState');
    const toast = document.getElementById('toast');

    // State variables
    let scrapedResults = [];
    let isScraping = false;

    const SAMPLE_URLS = [

    ];

    // Helper: Parse textarea input into array of URLs
    function getParsedUrls() {
        const text = urlInput.value || '';
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    // Update URL Count Badge
    function updateUrlCount() {
        const urls = getParsedUrls();
        urlCountBadge.textContent = `${urls.length} URL${urls.length === 1 ? '' : 's'}`;
    }

    urlInput.addEventListener('input', updateUrlCount);

    // Load Sample URLs
    btnSample.addEventListener('click', () => {
        urlInput.value = SAMPLE_URLS.join('\n');
        updateUrlCount();
        showToast('Sample URLs loaded!');
    });

    // Clear All Input & Results
    btnClear.addEventListener('click', () => {
        if (isScraping) return;
        urlInput.value = '';
        updateUrlCount();
        resetResultsState();
        showToast('Cleared input & results');
    });

    function resetResultsState() {
        scrapedResults = [];
        resultsList.innerHTML = '';
        resultsList.appendChild(emptyState);
        emptyState.classList.remove('hidden');

        statTotal.textContent = '0';
        statSuccess.textContent = '0';
        statFailed.textContent = '0';

        btnCopyAll.disabled = true;
        progressSection.classList.add('hidden');
        progressBarFill.style.width = '0%';
    }

    // Toast Notification Utility
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }

    // Start Scraping Action
    btnScrape.addEventListener('click', async () => {
        const urls = getParsedUrls();

        if (urls.length === 0) {
            alert('Please paste at least one Facebook Reel URL.');
            return;
        }

        if (isScraping) return;

        // Reset & Prepare UI State
        isScraping = true;
        btnScrape.disabled = true;
        btnScrapeText.textContent = 'Scraping...';
        btnCopyAll.disabled = true;

        scrapedResults = [];
        resultsList.innerHTML = '';
        emptyState.classList.add('hidden');

        statTotal.textContent = urls.length;
        statSuccess.textContent = '0';
        statFailed.textContent = '0';

        progressSection.classList.remove('hidden');
        progressPercent.textContent = '0%';
        progressBarFill.style.width = '0%';
        progressText.textContent = `Connecting to scraper server...`;

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to connect to scraper');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); // Keep incomplete chunk in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;

                    const eventMatch = line.match(/^event:\s*(.+)$/m);
                    const dataMatch = line.match(/^data:\s*(.+)$/m);

                    const event = eventMatch ? eventMatch[1].trim() : 'message';
                    const data = dataMatch ? JSON.parse(dataMatch[1].trim()) : {};

                    handleSSEEvent(event, data, urls.length);
                }
            }
        } catch (err) {
            console.error('Scrape error:', err);
            showToast(`Error: ${err.message}`);
            progressText.textContent = `Error: ${err.message}`;
        } finally {
            isScraping = false;
            btnScrape.disabled = false;
            btnScrapeText.textContent = 'Start Scraping';
            if (scrapedResults.length > 0) {
                btnCopyAll.disabled = false;
            }
        }
    });

    // Handle SSE event messages
    function handleSSEEvent(event, data, totalUrls) {
        if (event === 'start') {
            progressText.textContent = `Starting scraping of ${totalUrls} reels...`;
        } else if (event === 'progress') {
            const { completed, total, current } = data;

            scrapedResults.push(current);
            renderResultItem(current);

            // Update stats
            const successCount = scrapedResults.filter(r => r.status === 'success').length;
            const failCount = scrapedResults.filter(r => r.status === 'error').length;

            statSuccess.textContent = successCount;
            statFailed.textContent = failCount;

            const pct = Math.round((completed / total) * 100);
            progressPercent.textContent = `${pct}%`;
            progressBarFill.style.width = `${pct}%`;
            progressText.textContent = `Scraped ${completed} of ${total} reels...`;
        } else if (event === 'complete') {
            progressText.textContent = `Scraping complete! ${scrapedResults.length} reels processed.`;
            progressPercent.textContent = `100%`;
            progressBarFill.style.width = `100%`;
            showToast('All reel descriptions scraped!');
        } else if (event === 'error') {
            progressText.textContent = `Error: ${data.message}`;
        }
    }

    // Render individual result card into DOM
    function renderResultItem(item) {
        const itemEl = document.createElement('div');
        itemEl.className = 'result-item';

        const isSuccess = item.status === 'success';
        const badgeClass = isSuccess ? 'badge-success' : (item.status === 'warning' ? 'badge-warning' : 'badge-error');
        const badgeText = isSuccess ? 'Success' : (item.status === 'warning' ? 'No Desc' : 'Error');

        itemEl.innerHTML = `
            <div class="result-item-header">
                <span class="result-rank">Reel ${item.index}</span>
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="result-url" title="${item.url}">${item.url}</a>
            </div>
            <div class="result-body">${escapeHtml(item.description)}</div>
            <div class="result-item-footer">
                <span class="badge-status ${badgeClass}">${badgeText}</span>
                <button type="button" class="btn btn-secondary btn-sm btn-copy-single">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                </button>
            </div>
        `;

        const copyBtn = itemEl.querySelector('.btn-copy-single');
        copyBtn.addEventListener('click', () => {
            copyToClipboard(item.description);
            copyBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                `;
            }, 1800);
        });

        resultsList.appendChild(itemEl);
        resultsList.scrollTop = resultsList.scrollHeight;
    }

    // Copy All Descriptions Action
    btnCopyAll.addEventListener('click', () => {
        if (scrapedResults.length === 0) return;

        const formattedText = scrapedResults
            .map(item => `Reel ${item.index}: ${item.url}\nDescription:\n${item.description}`)
            .join('\n\n---\n\n');

        copyToClipboard(formattedText);
        showToast(`Copied ${scrapedResults.length} descriptions to clipboard!`);
    });

    // Helper: Copy string to clipboard
    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
    }

    function escapeHtml(str) {
        return (str || '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initial URL count badge check
    updateUrlCount();
});
