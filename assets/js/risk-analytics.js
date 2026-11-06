            function computeInstitutionMetrics(list, totalDeposits) {
                // Use filtered list if date filter is enabled
                const effectiveList = dateFilterEnabled ? filteredProcessedList : list;
                // When date filter is enabled (specific period), exclude funding; when disabled (since start), include funding
                const trades = effectiveList.filter(i => dateFilterEnabled ? (!i.isFunding && i.openDate && !isNaN(i.openDate.getTime()) && !isNaN(i.date.getTime())) : (i.openDate && !isNaN(i.openDate.getTime()) && !isNaN(i.date.getTime())));
                if (trades.length === 0) return;

                const initialDeposit = totalDeposits > 0 ? totalDeposits : (effectiveList.length > 0 ? effectiveList[0].balance : 10000);
                const netProfit = window.__latestNetProfit || 0;
                const maxDDPercent = window.__latestMaxDrawdownPercent || 0;
                const maxDDCash = window.__latestMaxDrawdownCash || 0;

                const firstDate = trades[0].openDate < trades[0].date ? trades[0].openDate : trades[0].date;
                let earliestDate = trades.reduce((min, t) => (t.openDate < min ? t.openDate : min), trades[0].openDate);
                const durationYears = Math.max((Date.now() - earliestDate.getTime()) / (1000*60*60*24*365.25), 0.05);

                const cagr = initialDeposit > 0 ? (Math.pow((initialDeposit + netProfit) / initialDeposit, 1/durationYears) - 1) * 100 : 0;

                // Build compounding monthly/daily return series from per-trade TWR-style returns
                const monthlyMap = {}, dailyMap = {};
                trades.forEach(t => {
                    const r = t.tradeReturnPercent / 100;
                    const mKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
                    const dKey = t.date.toISOString().split('T')[0];
                    monthlyMap[mKey] = (monthlyMap[mKey] === undefined ? 1 : monthlyMap[mKey]) * (1 + r);
                    dailyMap[dKey] = (dailyMap[dKey] === undefined ? 1 : dailyMap[dKey]) * (1 + r);
                });
                const monthlyReturns = Object.values(monthlyMap).map(v => v - 1);
                const dailyReturns = Object.values(dailyMap).map(v => v - 1);

                const avgMonthlyRet = monthlyReturns.reduce((a,b)=>a+b,0) / (monthlyReturns.length || 1);
                const avgDailyRet = dailyReturns.reduce((a,b)=>a+b,0) / (dailyReturns.length || 1);
                const monthlyStd = getStandardDeviation(monthlyReturns);

                // Cache base metrics (RFR-independent)
                cachedBaseMetrics = {
                    cagr,
                    avgMonthlyRet,
                    avgDailyRet,
                    monthlyStd,
                    monthlyReturns,
                    maxDDPercent,
                    maxDDCash,
                    netProfit,
                    initialDeposit,
                    durationYears
                };

                // Calculate RFR-dependent metrics
                const monthlyRf = ANNUAL_RISK_FREE_RATE / 100 / 12;
                const annSharpe = monthlyStd > 0 ? ((avgMonthlyRet - monthlyRf) / monthlyStd) * Math.sqrt(12) : 0;
                const downsideDiffs = monthlyReturns.filter(r => r < monthlyRf).map(r => Math.pow(r - monthlyRf, 2));
                const downsideDev = Math.sqrt(downsideDiffs.reduce((a,b)=>a+b,0) / (monthlyReturns.length || 1));
                const annSortino = downsideDev > 0 ? ((avgMonthlyRet - monthlyRf) / downsideDev) * Math.sqrt(12) : 0;
                const calmar = cagr / (maxDDPercent || 1);
                const realizedVol = monthlyStd * Math.sqrt(12) * 100;
                const varParametric = (avgMonthlyRet - 1.645 * monthlyStd) * Math.sqrt(12) * 100;
                const alpha = (cagr - ANNUAL_BENCHMARK_RETURN);

                const wins = trades.filter(t => t.profit > 0);
                const losses = trades.filter(t => t.profit < 0);
                const grossProfit = wins.reduce((s,t)=>s+t.profit,0);
                const grossLoss = Math.abs(losses.reduce((s,t)=>s+t.profit,0));
                const profitFactor = grossLoss > 0 ? grossProfit/grossLoss : (grossProfit > 0 ? Infinity : 0);
                const winRate = (wins.length / (trades.length || 1)) * 100;
                const recoveryFactor = netProfit / Math.abs(maxDDCash || 1);
                const expectancy = netProfit / (trades.length || 1);
                const avgWinAmt = wins.length ? grossProfit/wins.length : 0;
                const avgLossAmt = losses.length ? grossLoss/losses.length : 0;
                const rrRatio = avgLossAmt > 0 ? avgWinAmt/avgLossAmt : (avgWinAmt > 0 ? Infinity : 0);

                const updateMetric = (id, val, suffix = "", isRatio = false) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    
                    // Check if this is a private metric (Return Expectancy)
                    if (id === 'stat-expectancy' && financialPrivacyEnabled) {
                        el.innerText = '$xxxx.xx';
                    } else {
                        el.innerText = (isFinite(val) ? val.toFixed(2) : '∞') + suffix;
                    }
                    
                    const threshold = isRatio ? 1.0 : 0;
                    el.className = `metric-value ${val > threshold ? 'val-pos' : val < threshold ? 'val-neg' : 'val-neutral'}`;
                };

                updateMetric('stat-cagr', cagr, "%");
                updateMetric('stat-avg-monthly', avgMonthlyRet*100, "%");
                updateMetric('stat-avg-daily', avgDailyRet*100, "%");
                updateMetric('stat-sharpe', annSharpe);
                updateMetric('stat-sortino', annSortino);
                updateMetric('stat-calmar', calmar);
                updateMetric('stat-wr2', winRate, "%");
                document.getElementById('stat-vol').innerText = realizedVol.toFixed(2) + '%';
                document.getElementById('stat-vol').className = 'metric-value val-neutral';

                updateMetric('stat-var', varParametric, "%");
                updateMetric('stat-pf', profitFactor, "", true);
                updateMetric('stat-rec', recoveryFactor);
                updateMetric('stat-expectancy', expectancy, "$");
                updateMetric('stat-alpha', alpha, "%");
                document.getElementById('stat-rr').innerText = `1:${isFinite(rrRatio) ? rrRatio.toFixed(2) : '∞'}`;
                document.getElementById('stat-rr').className = `metric-value ${rrRatio >= 1 ? 'val-pos' : 'val-neg'}`;

                // ---- Duration Analysis ----
                const analyticsTrades = trades.map(t => ({
                    date: t.date, profit: t.profit, balance: t.balance,
                    duration: Math.max(0,(t.date - t.openDate)/60000),
                    returnPct: t.tradeReturnPercent, lots: t.volume || 0,
                    direction: (t.type || '').toLowerCase().includes('sell') || (t.type||'').toLowerCase().includes('short') ? 'SELL' : 'BUY'
                }));
                renderDurationAnalysis(analyticsTrades);

                // ---- Hourly / Daily Periodicity ----
                const hourlyStats = Array(24).fill(0);
                const dailyStats = Array(7).fill(0);
                analyticsTrades.forEach(t => { hourlyStats[t.date.getHours()] += t.returnPct; dailyStats[t.date.getDay()] += t.returnPct; });
                renderHourlyPerformance(hourlyStats);
                renderDailyPerformance(dailyStats);

                // ---- Factor Attribution (Long/Short) ----
                const directionStats = {};
                analyticsTrades.forEach(t => {
                    const dir = t.direction;
                    if (!directionStats[dir]) directionStats[dir] = { count:0, wins:0, grossProfit:0, grossLoss:0, totalProfit:0, sumReturns:0 };
                    directionStats[dir].count++;
                    directionStats[dir].totalProfit += t.profit;
                    directionStats[dir].sumReturns += (t.returnPct/100);
                    if (t.profit > 0) { directionStats[dir].wins++; directionStats[dir].grossProfit += t.profit; }
                    else if (t.profit < 0) { directionStats[dir].grossLoss += Math.abs(t.profit); }
                });
                renderAttribution(directionStats);

                // ---- Notional Exposure Matrix + Rebate ----
                renderLotsMatrixAndRebate(analyticsTrades);

                // ---- Risk of Ruin ----
                renderRiskOfRuin(analyticsTrades, wins.length, losses.length);

                // ---- Monte Carlo ----
                runMonteCarlo(analyticsTrades, initialDeposit);
            }

            function renderDurationAnalysis(trades) {
                const durations = trades.map(t => t.duration);
                if (durations.length === 0) return;
                const avg = durations.reduce((a,b)=>a+b,0)/durations.length;
                const max = Math.max(...durations);
                const min = Math.min(...durations);
                const sorted = [...durations].sort((a,b)=>b-a);
                const p5Value = sorted[Math.floor(sorted.length*0.05)] || 0;

                document.getElementById('dur-avg').innerText = formatDurationMinutes(avg);
                document.getElementById('dur-max').innerText = formatDurationMinutes(max);
                document.getElementById('dur-min').innerText = formatDurationMinutes(min);
                document.getElementById('dur-p5').innerText = formatDurationMinutes(p5Value);

                const ctx = document.getElementById('durationChart').getContext('2d');
                if (durationChartInstance) durationChartInstance.destroy();
                durationChartInstance = new Chart(ctx, {
                    type: 'scatter',
                    data: { datasets: [{ data: trades.map(t => ({x:t.duration, y:t.returnPct})), backgroundColor: trades.map(t => t.profit >= 0 ? 'rgba(0,200,83,0.4)' : 'rgba(255,69,69,0.4)'), borderColor:'transparent', pointRadius:4, hoverRadius:8 }] },
                    options: {
                        responsive:true, maintainAspectRatio:false,
                        plugins: { legend:{ display:false }, tooltip:{ backgroundColor:'rgba(0,0,0,0.9)', padding:12, callbacks:{ label:(c)=>[`Excess Return: ${c.parsed.y.toFixed(2)}%`, `Duration: ${formatDurationMinutes(c.parsed.x)}`] } } },
                        scales: {
                            x: { grid:{ color:'rgba(255,255,255,0.02)' }, title:{ display:true, text:'HOLDING DURATION', color:'#52525b', font:{size:9,weight:'900'} }, ticks:{ color:'#71717a', font:{size:9}, callback:v=>formatDurationMinutes(v) } },
                            y: { grid:{ color:'rgba(255,255,255,0.02)' }, title:{ display:true, text:'RETURN (%)', color:'#52525b', font:{size:9,weight:'900'} }, ticks:{ color:'#71717a', font:{size:9}, callback:v=>v+'%' } }
                        }
                    }
                });
            }

            function renderHourlyPerformance(data) {
                const ctx = document.getElementById('hourlyChart').getContext('2d');
                if (hourlyChartInstance) hourlyChartInstance.destroy();
                hourlyChartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: { labels: Array.from({length:24}, (_,i)=>`${i}:00`), datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? '#00C853' : '#FF4545'), borderRadius:0 }] },
                    options: {
                        responsive:true, maintainAspectRatio:false,
                        plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label:(c)=>`Total Return: ${c.parsed.y.toFixed(2)}%` } } },
                        scales: { x:{ grid:{ display:false }, ticks:{ color:'#52525b', font:{size:9} } }, y:{ grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#52525b', callback:v=>v.toFixed(1)+'%' } } }
                    }
                });
            }
            function renderDailyPerformance(data) {
                const ctx = document.getElementById('dailyPatternChart').getContext('2d');
                if (dailyPatternChartInstance) dailyPatternChartInstance.destroy();
                const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                dailyPatternChartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: { labels, datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? '#00C853' : '#FF4545'), borderRadius:0 }] },
                    options: {
                        responsive:true, maintainAspectRatio:false,
                        plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label:(c)=>`Total Return: ${c.parsed.y.toFixed(2)}%` } } },
                        scales: { x:{ grid:{ display:false }, ticks:{ color:'#52525b', font:{size:9} } }, y:{ grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#52525b', callback:v=>v.toFixed(1)+'%' } } }
                    }
                });
            }

            function renderAttribution(stats) {
                const body = document.getElementById('attribution-body');
                body.innerHTML = '';
                const totalBuy = stats['BUY']?.count || 0;
                const totalSell = stats['SELL']?.count || 0;
                const total = totalBuy + totalSell || 1;
                const buyPct = ((totalBuy/total)*100).toFixed(1);
                const sellPct = ((totalSell/total)*100).toFixed(1);

                document.getElementById('distribution-stats').innerHTML = `
                    <div class="space-y-1"><p class="metric-label">Long Exposure</p><p class="text-4xl font-black tracking-tighter text-emerald-500">${buyPct}<span class="text-lg ml-1 font-light opacity-50">%</span></p></div>
                    <div class="space-y-1 text-center">
                        <p class="metric-label">Total Trades</p>
                        <p class="text-4xl font-black tracking-tighter val-neutral">${total}</p>
                    </div>
                    <div class="space-y-1 text-right"><p class="metric-label">Short Exposure</p><p class="text-4xl font-black tracking-tighter text-rose-500">${sellPct}<span class="text-lg ml-1 font-light opacity-50">%</span></p></div>
                `;

                ['BUY','SELL'].forEach(key => {
                    const displayKey = key === 'BUY' ? 'LONG' : 'SHORT';
                    const s = stats[key] || { count:0, wins:0, grossProfit:0, grossLoss:0, totalProfit:0, sumReturns:0 };
                    const pf = s.grossProfit / (s.grossLoss || 1);
                    const wr = (s.wins / (s.count || 1)) * 100;
                    const expRet = (s.sumReturns / (s.count || 1)) * 100;
                    const pfClass = pf > 1 ? 'val-pos' : pf < 1 ? (s.count > 0 ? 'val-neg' : 'val-neutral') : 'val-neutral';
                    const expClass = expRet > 0 ? 'val-pos' : expRet < 0 ? 'val-neg' : 'val-neutral';
                    const row = document.createElement('tr');
                    row.className = "border-b border-zinc-900/50 hover:bg-white/5 transition-colors";
                    row.innerHTML = `
                        <td class="py-3 text-left font-black tracking-widest text-zinc-300">${displayKey}</td>
                        <td class="py-3 text-right font-light text-zinc-300">${s.count}</td>
                        <td class="py-3 text-right ${pfClass} font-light">${isFinite(pf) ? pf.toFixed(2) : '∞'}</td>
                        <td class="py-3 text-right font-light text-zinc-300">${wr.toFixed(1)}%</td>
                        <td class="py-3 text-right ${expClass} font-light">${expRet.toFixed(4)}%</td>
                    `;
                    body.appendChild(row);
                });

                const ctx = document.getElementById('attributionPieChart').getContext('2d');
                if (attributionChartInstance) attributionChartInstance.destroy();
                attributionChartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: { labels: ['Distribution'], datasets: [
                        { label:'LONG', data:[totalBuy], backgroundColor:'#00C853', barThickness:24, borderRadius:0 },
                        { label:'SHORT', data:[totalSell], backgroundColor:'#FF4545', barThickness:24, borderRadius:0 }
                    ] },
                    options: {
                        indexAxis:'y', responsive:true, maintainAspectRatio:false,
                        plugins: { legend:{ display:false }, tooltip:{ enabled:true, backgroundColor:'rgba(0,0,0,0.9)', padding:12, callbacks:{ label:(c)=>`${c.dataset.label}: ${c.parsed.x} Trades (${((c.parsed.x/total)*100).toFixed(1)}%)` } } },
                        scales: { x:{ stacked:true, display:false, max: total }, y:{ stacked:true, display:false } }
                    }
                });
            }

            function renderLotsMatrixAndRebate(trades) {
                const lotMatrix = {};
                trades.forEach(t => {
                    const y = t.date.getFullYear(), m = t.date.getMonth();
                    if (!lotMatrix[y]) lotMatrix[y] = Array(12).fill(0);
                    lotMatrix[y][m] += t.lots || 0;
                });
                let totalLots = 0;
                Object.keys(lotMatrix).forEach(y => lotMatrix[y].forEach(l => totalLots += l));
                const totalRebate = totalLots * REBATE_PER_LOT;

                const totalLotsEl = document.getElementById('stat-total-lots');
                const totalRebateEl = document.getElementById('stat-total-rebate');
                if (totalLotsEl) { totalLotsEl.innerText = totalLots.toFixed(2); totalLotsEl.className = 'metric-value val-neutral'; }
                if (totalRebateEl) { totalRebateEl.innerText = '$' + totalRebate.toFixed(2); totalRebateEl.className = 'metric-value val-pos'; }

                const body = document.getElementById('lots-monthly-body');
                if (!body) return;
                body.innerHTML = '';
                const sortedYears = Object.keys(lotMatrix).sort().reverse();
                if (sortedYears.length === 0) { body.innerHTML = '<tr><td colspan="14" class="text-center py-8 text-terminalMuted italic border-none">Awaiting cycles...</td></tr>'; return; }

                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                sortedYears.forEach(year => {
                    const row = document.createElement('tr');
                    let yearlyLots = 0;
                    let html = `<td class="font-black text-white">${year}</td>`;
                    for (let i = 0; i < 12; i++) {
                        const lots = lotMatrix[year][i];
                        if (!lots) html += `<td>-</td>`;
                        else {
                            const rebate = (lots * REBATE_PER_LOT).toFixed(2);
                            html += `<td onmouseenter="showTableTooltip('${months[i]}','${year}','${rebate}',true)" onmouseleave="hideTableTooltip()" class="hover:text-zinc-300 transition-colors cursor-pointer">${lots.toFixed(2)}</td>`;
                        }
                        yearlyLots += lots;
                    }
                    const totalRebateY = (yearlyLots * REBATE_PER_LOT).toFixed(2);
                    html += `<td class="font-black text-terminalMuted cursor-pointer" onmouseenter="showTableTooltip('Annual','${year}','${totalRebateY}',true)" onmouseleave="hideTableTooltip()">${yearlyLots.toFixed(2)}</td>`;
                    row.innerHTML = html;
                    body.appendChild(row);
                });
            }

            window.showTableTooltip = (period, year, val, isLots = true) => {
                const tooltip = document.getElementById('table-tooltip');
                tooltip.innerHTML = `<div class="text-[10px] font-black text-terminalMuted uppercase tracking-widest mb-1">${isLots ? 'Notional Exposure' : 'Monthly Return'} — ${period} ${year}</div><div class="text-xs font-light text-white">${isLots ? 'Rebate: $' + val : 'Yield: ' + val + '%'}</div>`;
                tooltip.style.display = 'block';
            };
            window.hideTableTooltip = () => { document.getElementById('table-tooltip').style.display = 'none'; };
            document.addEventListener('mousemove', (e) => {
                const tooltip = document.getElementById('table-tooltip');
                if (tooltip.style.display === 'block') { tooltip.style.left = (e.clientX + 16) + 'px'; tooltip.style.top = (e.clientY + 16) + 'px'; }
            });

            function renderRiskOfRuin(trades, winsCount, lossesCount) {
                const winRate = winsCount / (trades.length || 1);
                const avgWinPct = trades.filter(t => t.profit > 0).reduce((s,t)=>s+t.returnPct,0) / (winsCount || 1);
                const avgLossPct = Math.abs(trades.filter(t => t.profit < 0).reduce((s,t)=>s+t.returnPct,0) / (lossesCount || 1));
                const payoffRatio = avgWinPct / (avgLossPct || 1);

                const solveRoRRoot = (p, r) => {
                    if (p * r <= (1 - p)) return 1;
                    let low = 0, high = 1;
                    for (let i = 0; i < 40; i++) {
                        let mid = (low + high) / 2;
                        let val = p * Math.pow(mid, r + 1) - mid + (1 - p);
                        if (val > 0) low = mid; else high = mid;
                    }
                    return (low + high) / 2;
                };
                const root = solveRoRRoot(winRate, payoffRatio);

                for (let i = 10; i <= 100; i += 10) {
                    const units = i / (avgLossPct || 0.01);
                    let prob = Math.pow(root, units) * 100;
                    const el = document.getElementById(`ror-${i}`);
                    if (!el) continue;
                    if (prob < 0.01) {
                        if (prob === 0) { el.innerText = "0.00%"; el.className = "py-4 text-center font-medium val-neutral"; }
                        else { el.innerText = "< 0.01%"; el.className = "py-4 text-center font-medium val-pos"; }
                    } else if (prob >= 99.99) { el.innerText = root === 1 ? "100.00%" : "99.99%"; el.className = "py-4 text-center font-medium val-neg"; }
                    else { el.innerText = `${prob.toFixed(2)}%`; el.className = `py-4 text-center font-medium ${prob > 50 ? 'val-neg' : prob > 5 ? 'text-zinc-400' : 'val-pos'}`; }
                }
            }

            // ============================================================
            // MONTE CARLO SIMULATION
            // ============================================================
