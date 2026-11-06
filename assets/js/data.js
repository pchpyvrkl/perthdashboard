            function getPortfolioChecksum(data) {
                if (!Array.isArray(data)) return '';
                const count = data.length;
                const content = data.map(row => Object.values(row).join('|')).join('||');
                return `${count}::${content}`;
            }

            function fetchAndParseCSV(forceUpdate = false) {
                const url = `https://docs.google.com/spreadsheets/d/e/${SPREADSHEET_ID}/pub?output=csv&t=${Date.now()}`;
                Papa.parse(url, {
                    download: true, header: true, skipEmptyLines: true,
                    complete: function (results) {
                        if (results.errors.length > 0 && results.data.length === 0) return;
                        const newChecksum = getPortfolioChecksum(results.data);
                        if (!forceUpdate && portfolioDataChecksum && portfolioDataChecksum === newChecksum) return;
                        portfolioDataChecksum = newChecksum;
                        rawCSVData = results.data;
                        autoDetectAndMapColumns(results.meta.fields);
                        processPortfolio();
                    },
                    error: function (err) {}
                });
            }

            function autoDetectAndMapColumns(headers) {
                if (!headers || headers.length === 0) return;
                const timeCols = headers.filter(h => { const l = h.toLowerCase(); return l.includes('time') || l.includes('date') || l.includes('timestamp') || l === 'open' || l === 'close'; });
                columnMapping.date = headers.find(h => { const l = h.toLowerCase(); return (l.includes('close') && (l.includes('time') || l.includes('date'))) || (l === 'close'); });
                columnMapping.openDate = headers.find(h => { const l = h.toLowerCase(); return (l.includes('open') && (l.includes('time') || l.includes('date'))) || (l === 'open'); });
                if (timeCols.length >= 2) {
                    if (!columnMapping.openDate) columnMapping.openDate = timeCols[0];
                    if (!columnMapping.date) columnMapping.date = timeCols[timeCols.length - 1];
                }
                if (!columnMapping.date) columnMapping.date = timeCols[0] || headers[0];
                if (!columnMapping.openDate) columnMapping.openDate = columnMapping.date;
                columnMapping.profit = headers.find(h => { const l = h.toLowerCase(); return l.includes('profit') || l.includes('p&l') || l.includes('pnl') || l.includes('gain') || l.includes('net p'); }) || headers.find(h => h.toLowerCase().includes('amount')) || headers[1];
                columnMapping.balance = headers.find(h => { const l = h.toLowerCase(); return l.includes('balance') || l.includes('equity'); }) || '';
                columnMapping.type = headers.find(h => { const l = h.toLowerCase(); return l.includes('type') || l.includes('comment') || l.includes('action'); }) || '';
                columnMapping.symbol = headers.find(h => { const l = h.toLowerCase(); return l.includes('symbol') || l.includes('item') || l.includes('pair') || l.includes('market'); }) || '';
                columnMapping.volume = headers.find(h => { const l = h.toLowerCase(); return l.includes('volume') || l.includes('size') || l.includes('lots'); }) || '';
                const priceCols = headers.filter(h => h.toLowerCase().includes('price'));
                if (priceCols.length >= 2) { columnMapping.openPrice = priceCols[0]; columnMapping.closePrice = priceCols[priceCols.length - 1]; }
                else { columnMapping.openPrice = priceCols[0] || ''; columnMapping.closePrice = priceCols[0] || ''; }
                columnMapping.magic = headers.find(h => h.toLowerCase().includes('magic')) || '';
            }

            // ============================================================
            // DATE RANGE FILTERING
            // ============================================================
