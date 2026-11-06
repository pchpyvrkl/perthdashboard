            function initializeOverview() {
                // Hide all sections except overview sections
                const sectionsToHide = [
                    'institution-section',
                    'risk-assessment-section',
                    'holding-section',
                    'temporal-section',
                    'factor-section',
                    'risk-ruin-section',
                    'monte-carlo-section',
                    'monthly-heatmap-section',
                    'drawdown-heatmap-section',
                    'notional-section',
                    'rebate-section',
                    'report-generator-section',
                    'transactions-section',
                    'pl-activity-section'
                ];

                sectionsToHide.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                // Show overview sections
                const overviewSections = ['metrics-section', 'chart-section', 'open-trades-section', 'export-button-section'];
                overviewSections.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = '';
                });
            }

            window.onload = function () {
                // Initialize overview view as default
                initializeOverview();

                // Auto-hide page scrollbar when idle
                const mainEl = document.getElementById('main-content');
                let scrollHideTimer = null;
                mainEl.addEventListener('scroll', () => {
                    mainEl.classList.add('is-scrolling');
                    clearTimeout(scrollHideTimer);
                    scrollHideTimer = setTimeout(() => mainEl.classList.remove('is-scrolling'), 900);
                });

                updateWorldClocks();
                setInterval(updateWorldClocks, 1000);
                fetchAndParseCSV(true);
                fetchOpenTrades();
                setInterval(fetchOpenTrades, 1000);
                setInterval(() => fetchAndParseCSV(false), 15000);
                fetchNewsCalendar();
                setInterval(fetchNewsCalendar, 5 * 60 * 1000); // economic calendar rarely changes — 5 min is plenty
                restoreMacroCache();
                fetchMarketMacroRates();
                fetchTickerQuotes();
                setInterval(() => {
                    fetchMarketMacroRates();
                    fetchTickerQuotes();
                    // Full SPX history is a heavy payload — only refetch every 6h (daily closes barely move intraday)
                    if (Date.now() - lastSPXFetch > 6 * 60 * 60 * 1000) {
                        spxHistory = null;
                        ensureSPXHistory();
                    }
                }, 5 * 60 * 1000); // refresh quotes every 5 min
            };

            // ============================================================
            // OPEN TRADES (LIVE, 1s POLL) — light-weight updates only
            // ============================================================
