            function generateMonthlyReturns(list) {
                const tbody = document.getElementById('monthly-heatmap-body');
                if (!tbody) return;
                tbody.innerHTML = '';
                
                // Use filtered list if date filter is enabled
                const effectiveList = dateFilterEnabled ? filteredProcessedList : list;
                
                // Filter only non-funding trades for TWR calculation
                // When date filter is enabled (specific period), exclude funding; when disabled (since start), include funding
                const trades = effectiveList.filter(i => dateFilterEnabled ? (!i.isFunding && i.tradeReturnPercent !== undefined) : (i.tradeReturnPercent !== undefined));
                if (trades.length === 0) { tbody.innerHTML = '<tr><td colspan="14" class="text-center py-8 text-terminalMuted italic border-none">Awaiting data...</td></tr>'; return; }

                // Build compounding monthly returns using TWR (same as 3rd party)
                const monthlyMap = {};
                trades.forEach(t => {
                    const r = t.tradeReturnPercent / 100;
                    const mKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
                    monthlyMap[mKey] = (monthlyMap[mKey] === undefined ? 1 : monthlyMap[mKey]) * (1 + r);
                });

                // Convert compounded values to percentage returns
                Object.keys(monthlyMap).forEach(key => {
                    monthlyMap[key] = (monthlyMap[key] - 1) * 100;
                });

                let firstDate = trades[0].date, lastDate = trades[trades.length - 1].date;
                const yearsMap = {};
                let currY = firstDate.getFullYear(), currM = firstDate.getMonth();
                const stopY = lastDate.getFullYear(), stopM = lastDate.getMonth();
                while (currY < stopY || (currY === stopY && currM <= stopM)) {
                    const key = `${currY}-${currM}`;
                    if (!yearsMap[currY]) yearsMap[currY] = Array(12).fill(null);
                    yearsMap[currY][currM] = monthlyMap.hasOwnProperty(key) ? monthlyMap[key] : null;
                    currM++; if (currM > 11) { currM = 0; currY++; }
                }

                // Collect all non-null values to compute dynamic intensity thresholds
                const allVals = [];
                Object.keys(yearsMap).forEach(y => yearsMap[y].forEach(v => { if (v !== null) allVals.push(Math.abs(v)); }));
                const maxAbs = allVals.length ? Math.max(...allVals) : 10;

                // Returns inline style with green/red background + white text, intensity scales with magnitude
                function heatStyle(val) {
                    if (val === null) return '';
                    const norm = Math.min(Math.abs(val) / maxAbs, 1); // 0–1
                    // Use a gentle opacity curve: floor at 0.08, ceiling at 0.75
                    const opacity = 0.08 + norm * 0.67;
                    if (val > 0.001)  return `background:rgba(0,200,83,${opacity.toFixed(3)});color:${norm > 0.45 ? '#fff' : '#00C853'};`;
                    if (val < -0.001) return `background:rgba(255,69,69,${opacity.toFixed(3)});color:${norm > 0.45 ? '#fff' : '#FF4545'};`;
                    return 'color:#858585;';
                }

                function annualStyle(val) {
                    if (val > 0.01)  return 'background:rgba(0,200,83,0.18);color:#00C853;';
                    if (val < -0.01) return 'background:rgba(255,69,69,0.18);color:#FF4545;';
                    return 'color:#858585;';
                }

                const sortedYears = Object.keys(yearsMap).sort((a, b) => b - a);
                sortedYears.forEach(year => {
                    const row = document.createElement('tr');
                    row.className = "border-b border-zinc-900/50 hover:brightness-110 transition-all";
                    let annualTotal = 0;
                    let html = `<td class="py-3 px-2 text-left font-black text-terminalMuted border-r border-zinc-900 bg-black/20 text-[11px]">${year}</td>`;
                    for (let m = 0; m < 12; m++) {
                        const val = yearsMap[year][m];
                        if (val === null) {
                            html += `<td class="py-3 px-1 text-center border-r border-zinc-900 text-[10px] text-zinc-800">—</td>`;
                        } else {
                            annualTotal += val;
                            const style = heatStyle(val);
                            html += `<td class="py-3 px-1 text-center border-r border-zinc-900 font-black text-[10px] rounded-sm transition-all" style="${style}">${(val > 0 ? '+' : '')}${val.toFixed(2)}%</td>`;
                        }
                    }
                    const annStyle = annualStyle(annualTotal);
                    html += `<td class="py-3 px-2 text-right font-black text-[11px] rounded-sm" style="${annStyle}">${(annualTotal > 0.01 ? '+' : '')}${annualTotal.toFixed(2)}%</td>`;
                    row.innerHTML = html;
                    tbody.appendChild(row);
                });
            }

            // ============================================================
            // MAX DRAWDOWN HEATMAP (mirrors the static Quant Audit report's
            // "Max Drawdown Heatmap" section, but recomputed live — every 1s
            // tick recomputes from closed trades only.)
            //
            // IMPORTANT: this runs on the TWR gain% series (item.gainPercent),
            // the exact same basis as the Monthly Return Sheet above it and the
            // Current/Max Drawdown metric cards at the top of the page — NOT
            // raw dollar balance. processedList mixes real trades together
            // with deposit/withdrawal rows, and item.balance jumps on every
            // funding event; computing drawdown from balance would misread a
            // withdrawal as a catastrophic trading loss and a deposit as an
            // artificial new high. gainPercent is already funding-neutral (it
            // only advances on actual trade returns), so peak-to-trough on
            // that series gives the correct trading drawdown.
            // ============================================================
            function computeDrawdownMatrix(list) {
                const result = { matrix: {}, yearly: {} };
                if (!list || list.length === 0) return result;

                // Filter based on date filter: exclude funding when date filter is enabled, include when disabled
                const effectiveList = dateFilterEnabled ? list.filter(item => !item.isFunding) : list;
                if (effectiveList.length === 0) return result;

                const firstDate = effectiveList[0].date;
                const lastDate = effectiveList[effectiveList.length - 1].date;
                const startYear = firstDate.getFullYear();
                const endYear = lastDate.getFullYear();
                for (let y = startYear; y <= endYear; y++) { result.matrix[y] = Array(12).fill(0); result.yearly[y] = 0; }

                // Chart shows closed trades only, no unrealized P/L
                // Use proper drawdown calculation: (currentValue - peakValue) / peakValue * 100
                let runningPeakValue = 100; // Start with baseline of 100%
                effectiveList.forEach((item, idx) => {
                    const gain = idx === 0 ? 0 : item.gainPercent;
                    const currentValue = 100 + gain;
                    
                    // Update running peak (high water mark)
                    if (currentValue > runningPeakValue) runningPeakValue = currentValue;
                    
                    // Calculate proper drawdown as percentage from peak
                    const ddPct = ((currentValue - runningPeakValue) / runningPeakValue) * 100; // always <= 0

                    const y = item.date.getFullYear(), m = item.date.getMonth();
                    if (ddPct < result.matrix[y][m]) result.matrix[y][m] = ddPct;
                    if (ddPct < result.yearly[y]) result.yearly[y] = ddPct;
                });

                return result;
            }

            function renderDrawdownHeatmap(list) {
                const tbody = document.getElementById('drawdown-heatmap-body');
                if (!tbody) return;
                // Use filtered list if date filter is enabled
                const effectiveList = dateFilterEnabled ? filteredProcessedList : list;
                const { matrix, yearly } = computeDrawdownMatrix(effectiveList);
                const sortedYears = Object.keys(matrix).sort((a, b) => b - a);
                if (sortedYears.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="14" class="text-center py-8 text-terminalMuted italic border-none">Awaiting data...</td></tr>';
                    return;
                }

                // Dynamic intensity scaling, same visual language as the return heatmap
                const allVals = [];
                sortedYears.forEach(y => matrix[y].forEach(v => { if (v !== 0) allVals.push(Math.abs(v)); }));
                const maxAbs = allVals.length ? Math.max(...allVals) : 10;

                function ddStyle(val) {
                    if (val === 0) return '';
                    const norm = Math.min(Math.abs(val) / maxAbs, 1);
                    const opacity = 0.08 + norm * 0.67;
                    return `background:rgba(239,68,68,${opacity.toFixed(3)});color:${norm > 0.45 ? '#fff' : '#FF4545'};`;
                }
                function ddAnnualStyle(val) {
                    if (val < -0.01) return 'background:rgba(239,68,68,0.18);color:#FF4545;';
                    return 'color:#71717a;';
                }

                tbody.innerHTML = '';
                sortedYears.forEach(year => {
                    const row = document.createElement('tr');
                    row.className = "border-b border-zinc-900/50 hover:brightness-110 transition-all";
                    let html = `<td class="py-3 px-2 text-left font-black text-terminalMuted border-r border-zinc-900 bg-black/20 text-[11px]">${year}</td>`;
                    for (let m = 0; m < 12; m++) {
                        const val = matrix[year][m];
                        if (val === 0) {
                            html += `<td class="py-3 px-1 text-center border-r border-zinc-900 text-[10px] text-zinc-800">—</td>`;
                        } else {
                            const style = ddStyle(val);
                            html += `<td class="py-3 px-1 text-center border-r border-zinc-900 font-black text-[10px] rounded-sm transition-all" style="${style}">${val.toFixed(2)}%</td>`;
                        }
                    }
                    const yearlyVal = yearly[year];
                    const annStyle = ddAnnualStyle(yearlyVal);
                    html += `<td class="py-3 px-2 text-right font-black text-[11px] rounded-sm" style="${annStyle}">${yearlyVal.toFixed(2)}%</td>`;
                    row.innerHTML = html;
                    tbody.appendChild(row);
                });
            }

            // ============================================================
            // P/L ACTIVITY CALENDAR
            // ============================================================
