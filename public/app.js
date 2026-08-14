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
    const btnCopyAsList = document.getElementById('btnCopyAsList');
    const btnCopyAsListText = document.getElementById('btnCopyAsListText');
    const btnGenerateScript = document.getElementById('btnGenerateScript');
    const btnGenerateScriptText = document.getElementById('btnGenerateScriptText');

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

    // AI Modal Elements
    const aiModalOverlay = document.getElementById('aiModalOverlay');
    const aiModalClose = document.getElementById('aiModalClose');
    const aiModalOriginalText = document.getElementById('aiModalOriginalText');
    const aiSuggestions = document.getElementById('aiSuggestions');
    const aiModalLoading = document.getElementById('aiModalLoading');
    const aiModalError = document.getElementById('aiModalError');
    const aiModalErrorText = document.getElementById('aiModalErrorText');

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
        btnCopyAsList.disabled = true;
        btnGenerateScript.disabled = true;
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
                btnCopyAsList.disabled = false;
                btnGenerateScript.disabled = false;
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
                <div class="result-footer-actions">
                    ${isSuccess ? `<button type="button" class="btn btn-ai btn-sm btn-ai-enhance">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                            <path d="M2 17l10 5 10-5"></path>
                            <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        ✨ AI Enhance
                    </button>` : ''}
                    <button type="button" class="btn btn-secondary btn-sm btn-copy-single">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    </button>
                </div>
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

        // AI Enhance Button handler (only rendered for successful scrapes)
        const aiBtn = itemEl.querySelector('.btn-ai-enhance');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => openAiModal(item.description, aiBtn));
        }

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

    // Copy as List Action — descriptions joined by commas (one per line)
    btnCopyAsList.addEventListener('click', () => {
        if (scrapedResults.length === 0) return;

        const listText = scrapedResults
            .filter(item => item.status === 'success' && item.description)
            .map(item => item.description)
            .join(',\n');

        copyToClipboard(listText);

        const count = scrapedResults.filter(item => item.status === 'success' && item.description).length;
        showToast(`Copied ${count} descriptions as list!`);

        const original = btnCopyAsListText.textContent;
        btnCopyAsListText.textContent = 'Copied!';
        setTimeout(() => { btnCopyAsListText.textContent = original; }, 1800);
    });

    // Generate Script Action — builds a browser-console auto-fill script
    btnGenerateScript.addEventListener('click', () => {
        if (scrapedResults.length === 0) return;

        const descriptions = scrapedResults
            .filter(function(item) { return item.status === 'success' && item.description; })
            .map(function(item) { return item.description; });

        // Build the JS array content with proper JSON escaping for each entry
        var arrayLines = descriptions.map(function(desc, i) {
            var escaped = JSON.stringify(desc);
            return i < descriptions.length - 1
                ? '  ' + escaped + ','
                : '  ' + escaped;
        }).join('\n');

        var scriptParts = [
            '// 1. Define your list of descriptions',
            'const descriptions = [',
            arrayLines,
            '];',
            '',
            '// 2. Select all text areas that match your specified class',
            '// Note: "description input-text" translates to the CSS selector ".description.input-text"',
            'const textAreas = document.querySelectorAll(\'.description.input-text\');',
            '',
            '// 3. Loop through each text area and insert the corresponding description',
            'textAreas.forEach((textArea, index) => {',
            '  // Only insert if we have a description for this index',
            '  if (index < descriptions.length) {',
            '    textArea.value = descriptions[index];',
            '',
            '    // Dispatch input and change events to ensure the website\'s framework registers the update',
            '    textArea.dispatchEvent(new Event(\'input\', { bubbles: true }));',
            '    textArea.dispatchEvent(new Event(\'change\', { bubbles: true }));',
            '  }',
            '});',
            '',
            'console.log("' + String.fromCodePoint(0x2705) + ' Successfully pushed " + Math.min(descriptions.length, textAreas.length) + " descriptions.");'
        ];

        var script = scriptParts.join('\n');

        copyToClipboard(script);
        showToast('Script with ' + descriptions.length + ' descriptions copied!');

        var original = btnGenerateScriptText.textContent;
        btnGenerateScriptText.textContent = 'Copied!';
        setTimeout(function() { btnGenerateScriptText.textContent = original; }, 1800);
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

    // ── AI Enhance Modal Logic ──────────────────────────────────────────────

    function openAiModal(description, triggerBtn) {
        // Show overlay
        aiModalOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Reset state
        aiModalOriginalText.textContent = description;
        aiSuggestions.innerHTML = '';
        aiSuggestions.classList.add('hidden');
        aiModalError.classList.add('hidden');
        aiModalLoading.classList.remove('hidden');

        // Set trigger button to loading
        const originalBtnHTML = triggerBtn ? triggerBtn.innerHTML : '';
        if (triggerBtn) {
            triggerBtn.disabled = true;
            triggerBtn.innerHTML = `<span class="ai-btn-spinner"></span> Generating...`;
        }

        fetch('/api/ai-enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server error');
            return data;
        })
        .then(data => {
            aiModalLoading.classList.add('hidden');
            renderSuggestions(data.suggestions);
        })
        .catch(err => {
            aiModalLoading.classList.add('hidden');
            aiModalError.classList.remove('hidden');
            aiModalErrorText.textContent = err.message;
        })
        .finally(() => {
            if (triggerBtn) {
                triggerBtn.disabled = false;
                triggerBtn.innerHTML = originalBtnHTML;
            }
        });
    }

    function renderSuggestions(suggestions) {
        aiSuggestions.innerHTML = '';
        suggestions.forEach((text, i) => {
            const card = document.createElement('div');
            card.className = 'ai-suggestion-card';
            card.innerHTML = `
                <div class="ai-suggestion-header">
                    <span class="ai-suggestion-num">ជម្រើសទី ${i + 1}</span>
                    <button type="button" class="btn btn-secondary btn-sm ai-suggestion-copy">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    </button>
                </div>
                <p class="ai-suggestion-text">${escapeHtml(text)}</p>
            `;
            const copyBtn = card.querySelector('.ai-suggestion-copy');
            copyBtn.addEventListener('click', () => {
                copyToClipboard(text);
                copyBtn.innerHTML = `
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Copied!
                `;
                showToast('Copied to clipboard!');
                setTimeout(() => {
                    copyBtn.innerHTML = `
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    `;
                }, 1800);
            });
            aiSuggestions.appendChild(card);
        });
        aiSuggestions.classList.remove('hidden');
    }

    function closeAiModal() {
        aiModalOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    aiModalClose.addEventListener('click', closeAiModal);
    aiModalOverlay.addEventListener('click', (e) => {
        if (e.target === aiModalOverlay) closeAiModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aiModalOverlay.classList.contains('open')) closeAiModal();
    });

    // Initial URL count badge check
    updateUrlCount();
});
