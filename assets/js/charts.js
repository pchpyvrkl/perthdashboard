            let cachedBaseMetrics = null;

            function updateRFRDependentMetrics(base) {
                const monthlyRf = ANNUAL_RISK_FREE_RATE / 100 / 12;
                const annSharpe = base.monthlyStd > 0 ? ((base.avgMonthlyRet - monthlyRf) / base.monthlyStd) * Math.sqrt(12) : 0;
                const downsideDiffs = base.monthlyReturns.filter(r => r < monthlyRf).map(r => Math.pow(r - monthlyRf, 2));
                const downsideDev = Math.sqrt(downsideDiffs.reduce((a,b)=>a+b,0) / (base.monthlyReturns.length || 1));
                const annSortino = downsideDev > 0 ? ((base.avgMonthlyRet - monthlyRf) / downsideDev) * Math.sqrt(12) : 0;

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

                updateMetric('stat-sharpe', annSharpe);
                updateMetric('stat-sortino', annSortino);
            }

            function updateBenchmarkDependentMetrics(base) {
                const alpha = (base.cagr - ANNUAL_BENCHMARK_RETURN);
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
                updateMetric('stat-alpha', alpha, "%");
            }

                    // ============================================================
            // CHART CONTROLS
            // ============================================================
            let activeMainView = 'chart';

            function switchMainView(view) {
                activeMainView = view;
                const chartView = document.getElementById('main-chart-view');
                const newsView = document.getElementById('main-news-view');
                const chartControls = document.getElementById('chart-mode-controls');
                const newsUpdatedEl = document.getElementById('news-updated-at');
                const titleEl = document.getElementById('main-view-title');
                const btnChart = document.getElementById('btn-view-chart');
                const btnNews = document.getElementById('btn-view-news');

                const activeCls = "px-2 py-1 text-[10px] font-bold transition-all bg-terminalPanel text-terminalText border border-terminalAmber";
                const inactiveCls = "px-2 py-1 text-[10px] font-bold transition-all text-terminalMuted hover:text-terminalText";

                if (view === 'news') {
                    chartView.classList.add('hidden');
                    newsView.classList.remove('hidden');
                    chartControls.classList.add('hidden');
                    newsUpdatedEl.classList.remove('hidden');
                    titleEl.textContent = 'Upcoming US Economic News';
                    btnNews.className = activeCls;
                    btnChart.className = inactiveCls;
                } else {
                    newsView.classList.add('hidden');
                    chartView.classList.remove('hidden');
                    chartControls.classList.remove('hidden');
                    newsUpdatedEl.classList.add('hidden');
                    titleEl.textContent = 'Equity Curve & Portfolio Gain';
                    btnChart.className = activeCls;
                    btnNews.className = inactiveCls;
                    // Charts don't redraw while their canvas is hidden — force a redraw now that it's visible again
                    if (processedList.length > 0) renderChart(processedList);
                }
            }

            function changeChartType(type) {
                activeChartType = type;
                const btnGain = document.getElementById('btn-chart-gain');
                const btnBal = document.getElementById('btn-chart-balance');
                if (type === 'gain') { btnGain.className = "px-2 py-1 text-[10px] font-bold transition-all bg-terminalAmber text-terminalBlack"; btnBal.className = "px-2 py-1 text-[10px] font-bold transition-all text-terminalMuted hover:text-terminalText"; }
                else { btnBal.className = "px-2 py-1 text-[10px] font-bold transition-all bg-terminalAmber text-terminalBlack"; btnGain.className = "px-2 py-1 text-[10px] font-bold transition-all text-terminalMuted hover:text-terminalText"; }
                if (processedList.length > 0) renderChart(processedList);
            }
            function changePeriodMode(mode) {
                activePeriodMode = mode;
                isFirstDrawdownRender = true; // re-animate drawdown on period change
                ['trade','daily','monthly','yearly'].forEach(btn => {
                    const el = document.getElementById(`btn-period-${btn}`);
                    el.className = btn === mode ? "px-2 py-1 text-[10px] font-bold transition-all bg-terminalPanel text-terminalText border border-terminalAmber" : "px-2 py-1 text-[10px] font-bold transition-all text-terminalMuted hover:text-terminalText";
                });
                if (processedList.length > 0) renderChart(processedList);
            }

            // ============================================================
            // EQUITY CURVE + UNDERWATER DRAWDOWN CHART
            // ============================================================
            function renderChart(list) {
                const ctx = document.getElementById('equityChart').getContext('2d');
                if (chartInstance) chartInstance.destroy();

                // Use filtered list if date filter is enabled
                const effectiveList = dateFilterEnabled ? filteredProcessedList : list;
                
                // Use shared unrealized gain percent for drawdown chart (only when date filter is NOT enabled)
                const unrealizedGainPercent = dateFilterEnabled ? 0 : sharedUnrealizedGainPercent;

                let aggregatedData = [], labels = [], aggKeys = [];
                if (activePeriodMode === 'trade') {
                    labels = effectiveList.map((item, i) => `${i + 1}`);
                    aggKeys = effectiveList.map((item, i) => `${i + 1}`);
                    aggregatedData = effectiveList.map((item, i) => ({ 
                        balance: item.balance, 
                        gainPercent: i === 0 ? 0 : item.gainPercent
                    }));
                } else if (activePeriodMode === 'daily') {
                    const dailyMap = {};
                    let isFirstDaily = true;
                    const sortedDates = [...new Set(effectiveList.map(item => item.date.toISOString().split('T')[0]))].sort();
                    effectiveList.forEach(item => {
                        const key = item.date.toISOString().split('T')[0];
                        if (isFirstDaily) {
                            dailyMap[key] = { balance: item.balance, gainPercent: 0 };
                            isFirstDaily = false;
                        } else {
                            dailyMap[key] = {
                                balance: item.balance,
                                gainPercent: item.gainPercent
                            };
                        }
                    });
                    Object.keys(dailyMap).sort().forEach(date => { labels.push(date); aggKeys.push(date); aggregatedData.push(dailyMap[date]); });
                } else if (activePeriodMode === 'monthly') {
                    const monthlyMap = {};
                    let isFirstMonthly = true;
                    const sortedKeys = [...new Set(effectiveList.map(item => `${item.date.getFullYear()}-${(item.date.getMonth()+1).toString().padStart(2,'0')}`))].sort();
                    effectiveList.forEach(item => {
                        const key = `${item.date.getFullYear()}-${(item.date.getMonth()+1).toString().padStart(2,'0')}`;
                        if (isFirstMonthly) {
                            monthlyMap[key] = { balance: item.balance, gainPercent: 0 };
                            isFirstMonthly = false;
                        } else {
                            monthlyMap[key] = {
                                balance: item.balance,
                                gainPercent: item.gainPercent
                            };
                        }
                    });
                    Object.keys(monthlyMap).sort().forEach(key => { const [y,m] = key.split('-'); labels.push(`${new Date(y,m-1).toLocaleString('default',{month:'short'})} ${y}`); aggKeys.push(key); aggregatedData.push(monthlyMap[key]); });
                } else if (activePeriodMode === 'yearly') {
                    const yearlyMap = {};
                    let isFirstYearly = true;
                    const sortedYears = [...new Set(effectiveList.map(item => item.date.getFullYear()))].sort();
                    effectiveList.forEach(item => {
                        const key = item.date.getFullYear();
                        if (isFirstYearly) {
                            yearlyMap[key] = { balance: item.balance, gainPercent: 0 };
                            isFirstYearly = false;
                        } else {
                            yearlyMap[key] = {
                                balance: item.balance,
                                gainPercent: item.gainPercent
                            };
                        }
                    });
                    Object.keys(yearlyMap).sort().forEach(year => { labels.push(year); aggKeys.push(year); aggregatedData.push(yearlyMap[year]); });
                }

                // Strip unrealized from the closed-trades line (it was baked in — rebuild without it)
                const totalDepositsForExt = list.reduce((s, item) => item.isFunding && item.profit > 0 ? s + item.profit : s, 0);
                const initDepForExt = totalDepositsForExt > 0 ? totalDepositsForExt : (list.length > 0 ? list[0].balance : 10000);

                const datasetValues = activeChartType === 'gain' ? aggregatedData.map(item => parseFloat(item.gainPercent.toFixed(2))) : aggregatedData.map(item => parseFloat(item.balance.toFixed(2)));
                const labelString = activeChartType === 'gain' ? 'TWR Return Gain %' : 'Account Balance $';

                // S&P 500 overlay — aligned to the same period keys, normalized to the
                // first visible point (0% in gain mode, first balance in balance mode)
                let spxValues = null;
                if (activePeriodMode !== 'trade') {
                    ensureSPXHistory();
                    if (spxHistory) {
                        const lookup = activePeriodMode === 'daily' ? spxHistory.byDay
                                    : activePeriodMode === 'monthly' ? spxHistory.byMonth
                                    : spxHistory.byYear;
                        const closes = aggKeys.map(k => lookup[k] ?? null);
                        const firstIdx = closes.findIndex(c => c !== null);
                        if (firstIdx >= 0) {
                            const baseClose = closes[firstIdx];
                            const baseValue = activeChartType === 'gain' ? 0 : aggregatedData[firstIdx].balance;
                            spxValues = closes.map((c, i) => {
                                if (c === null) return i < firstIdx ? baseValue : null;
                                const ratio = c / baseClose;
                                return parseFloat((activeChartType === 'gain' ? (ratio - 1) * 100 : baseValue * ratio).toFixed(2));
                            });
                        }
                    }
                }

                // Calculate highest and lowest gain percentages for display
                let highestGain = 0, lowestGain = 0;
                if (activeChartType === 'gain' && datasetValues.length > 0) {
                    highestGain = Math.max(...datasetValues);
                    lowestGain = Math.min(...datasetValues);
                }
                
                // Store values for use in animation callback
                const chartHighestGain = highestGain;
                const chartLowestGain = lowestGain;

                // Dynamic green/red line split at 0 for gain mode, solid blue for balance mode
                const buildDynColor = (chart, pos, neg, neutral) => {
                    const { ctx: c2, chartArea, scales } = chart;
                    if (!chartArea || !scales.y) return neutral;
                    const zero = scales.y.getPixelForValue(0);
                    const top = chartArea.top, bottom = chartArea.bottom;
                    const range = bottom - top;
                    if (range <= 0) return neutral;
                    const stop = Math.max(0, Math.min(1, (zero - top) / range));
                    const g = c2.createLinearGradient(0, top, 0, bottom);
                    g.addColorStop(0, pos);
                    g.addColorStop(Math.max(0, stop - 0.001), pos);
                    g.addColorStop(Math.min(1, stop + 0.001), neg);
                    g.addColorStop(1, neg);
                    return g;
                };

                chartInstance = new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets: [
                        // Main closed-trades line
                        { label: labelString, data: datasetValues,
                            borderColor: activeChartType === 'gain'
                                ? (c) => buildDynColor(c.chart, '#00C853', '#FF4545', '#00C853')
                                : '#00D5E8',
                            borderWidth: 2.5,
                            backgroundColor: activeChartType === 'gain'
                                ? (c) => buildDynColor(c.chart, 'rgba(0,200,83,0.28)', 'rgba(255,69,69,0.28)', 'rgba(0,200,83,0.15)')
                                : (c) => { const g = c.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0,'rgba(0,213,232,0.25)'); g.addColorStop(1,'rgba(0,213,232,0)'); return g; },
                            fill: true, tension: 0.1,
                            pointRadius: aggregatedData.length < 50 ? 3 : 0,
                            pointBackgroundColor: (c) => {
                                const v = c.raw;
                                return activeChartType === 'gain' ? (v >= 0 ? '#00C853' : '#FF4545') : '#00D5E8';
                            },
                            pointHoverRadius: 6, pointHitRadius: 10
                        },
                        // S&P 500 benchmark overlay (DLY/MTH/YR periods only)
                        ...(spxValues ? [{
                            label: 'S&P 500', data: spxValues,
                            borderColor: '#FFB000', borderWidth: 2,
                            pointRadius: 0, pointHoverRadius: 6, pointHitRadius: 20,
                            fill: false, tension: 0.1, spanGaps: true
                        }] : []),
                        // Horizontal dashed lines for highest and lowest gain (only in gain mode)
                        ...(activeChartType === 'gain' && datasetValues.length > 0 ? [
                            { data: Array(datasetValues.length).fill(highestGain), borderColor:'#00C853', borderWidth:1, borderDash:[5,5], pointRadius:0, fill:false },
                            { data: Array(datasetValues.length).fill(lowestGain), borderColor:'#FF4545', borderWidth:1, borderDash:[5,5], pointRadius:0, fill:false }
                        ] : [])
                    ] },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        animation: isFirstChartRender ? { 
                            duration: 800, 
                            easing: 'easeOutQuart',
                            onComplete: function() {
                                // Position labels after animation completes
                                setTimeout(() => {
                                    if (activeChartType === 'gain' && datasetValues.length > 0) {
                                        const highestLabel = document.getElementById('highest-gain-label');
                                        const lowestLabel = document.getElementById('lowest-gain-label');
                                        
                                        if (chartInstance && chartInstance.scales && chartInstance.scales.y && chartInstance.chartArea) {
                                            const yScale = chartInstance.scales.y;
                                            const chartArea = chartInstance.chartArea;
                                            
                                            // Get pixel positions for the values
                                            const highestPixel = yScale.getPixelForValue(chartHighestGain);
                                            const lowestPixel = yScale.getPixelForValue(chartLowestGain);
                                            
                                            // Position labels above the lines
                                            highestLabel.style.display = 'block';
                                            highestLabel.style.top = (chartArea.top + highestPixel - 15) + 'px';
                                            highestLabel.textContent = chartHighestGain.toFixed(2) + '%';
                                            
                                            lowestLabel.style.display = 'block';
                                            lowestLabel.style.top = (chartArea.top + lowestPixel - 15) + 'px';
                                            lowestLabel.textContent = chartLowestGain.toFixed(2) + '%';
                                        }
                                    } else {
                                        document.getElementById('highest-gain-label').style.display = 'none';
                                        document.getElementById('lowest-gain-label').style.display = 'none';
                                    }
                                }, 50);
                            }
                        } : false,
                        plugins: { legend: { display:false }, tooltip: { backgroundColor:'#09090b', titleColor:'#71717a', bodyColor:'#f8fafc', borderColor:'#27272a', borderWidth:1, padding:10, displayColors:false,
                            callbacks: { title: (c) => c[0].label.replace('#', ''), label: (c) => c.dataset.label === 'S&P 500'
                                ? `S&P 500: ${activeChartType === 'gain' ? c.raw + '%' : '$' + c.raw.toLocaleString(undefined,{maximumFractionDigits:0})}`
                                : (activeChartType === 'gain' ? `Gain: ${c.raw}%` : `Balance: $${c.raw.toLocaleString(undefined,{minimumFractionDigits:2})}`) } } },
                        scales: {
                            x: { grid:{ color:'#383838', drawTicks:false }, ticks:{ color:'#858585', font:{size:10, family:'monospace'}, maxTicksLimit:8 } },
                            y: { grid:{ color:'#383838', drawTicks:false }, ticks:{ color:'#858585', font:{size:10, family:'monospace'}, callback: v => activeChartType === 'gain' ? v + '%' : '$' + v.toLocaleString() } }
                        }
                    }
                });
                isFirstChartRender = false;

                // Position labels immediately if no animation (after first render)
                if (!isFirstChartRender) {
                    setTimeout(() => {
                        if (activeChartType === 'gain' && datasetValues.length > 0) {
                            const highestLabel = document.getElementById('highest-gain-label');
                            const lowestLabel = document.getElementById('lowest-gain-label');
                            
                            if (chartInstance && chartInstance.scales && chartInstance.scales.y && chartInstance.chartArea) {
                                const yScale = chartInstance.scales.y;
                                const chartArea = chartInstance.chartArea;
                                
                                // Get pixel positions for the values
                                const highestPixel = yScale.getPixelForValue(chartHighestGain);
                                const lowestPixel = yScale.getPixelForValue(chartLowestGain);
                                
                                // Position labels above the lines
                                highestLabel.style.display = 'block';
                                highestLabel.style.top = (chartArea.top + highestPixel - 15) + 'px';
                                highestLabel.textContent = chartHighestGain.toFixed(2) + '%';
                                
                                lowestLabel.style.display = 'block';
                                lowestLabel.style.top = (chartArea.top + lowestPixel - 15) + 'px';
                                lowestLabel.textContent = chartLowestGain.toFixed(2) + '%';
                            }
                        } else {
                            document.getElementById('highest-gain-label').style.display = 'none';
                            document.getElementById('lowest-gain-label').style.display = 'none';
                        }
                    }, 50);
                }

                // Underwater / drawdown chart (gain% basis, including unrealized for current point)
                let runningPeak = -Infinity;
                const ddSeries = aggregatedData.map((item, idx) => {
                    const isLast = idx === aggregatedData.length - 1;
                    // Add unrealized to the last point to match current drawdown calculation
                    const gainWithUnrealized = isLast ? item.gainPercent + unrealizedGainPercent : item.gainPercent;
                    if (gainWithUnrealized > runningPeak) runningPeak = gainWithUnrealized;
                    // Calculate drawdown as percentage from peak: (current - peak) / (100 + peak) * 100
                    // This converts gain% to actual value, then calculates % drop from peak
                    const currentValue = 100 + gainWithUnrealized;
                    const peakValue = 100 + runningPeak;
                    const drawdown = ((currentValue - peakValue) / peakValue) * 100;
                    return parseFloat(drawdown.toFixed(2));
                });

                // Calculate and display maximum drawdown
                let maxDrawdown = 0;
                if (ddSeries.length > 0) {
                    maxDrawdown = Math.min(...ddSeries); // Most negative value = maximum drawdown
                }
                
                // Store for use in animation callback
                const chartMaxDrawdown = maxDrawdown;
                const ddCtx = document.getElementById('drawdownChart').getContext('2d');
                if (drawdownChartInstance) drawdownChartInstance.destroy();
                drawdownChartInstance = new Chart(ddCtx, {
                    type: 'line',
                    data: { labels, datasets: [
                        { data: ddSeries, borderColor:'#FF4545', borderWidth:1.5, pointRadius:0, fill:'origin', backgroundColor:'rgba(255,69,69,0.15)', tension:0.1 },
                        // Horizontal dashed line at max drawdown
                        ...(ddSeries.length > 0 ? [{ data: Array(ddSeries.length).fill(maxDrawdown), borderColor:'#FF4545', borderWidth:1, borderDash:[5,5], pointRadius:0, pointHoverRadius:0, fill:false }] : [])
                    ] },
                    options: {
                        responsive:true, maintainAspectRatio:false, interaction:{ intersect:false, mode:'index' },
                        animation: isFirstDrawdownRender ? { 
                            duration: 600, 
                            easing: 'easeOutQuart',
                            onComplete: function() {
                                // Position label after animation completes
                                setTimeout(() => {
                                    const maxDDLabel = document.getElementById('max-drawdown-label');
                                    
                                    if (drawdownChartInstance && drawdownChartInstance.scales && drawdownChartInstance.scales.y && drawdownChartInstance.chartArea) {
                                        const yScale = drawdownChartInstance.scales.y;
                                        const chartArea = drawdownChartInstance.chartArea;
                                        
                                        // Get pixel position for the max drawdown value (horizontal dashed line level)
                                        const maxDDPixel = yScale.getPixelForValue(chartMaxDrawdown);
                                        
                                        // Position label above the horizontal dashed line on the right side
                                        maxDDLabel.style.display = 'block';
                                        maxDDLabel.style.top = (chartArea.top + maxDDPixel - 12) + 'px';
                                        maxDDLabel.style.left = 'auto';
                                        maxDDLabel.style.right = '5px';
                                        maxDDLabel.style.transform = 'none';
                                        maxDDLabel.textContent = chartMaxDrawdown.toFixed(2) + '%';
                                    } else {
                                        maxDDLabel.style.display = 'none';
                                    }
                                }, 50);
                            }
                        } : false,
                        layout: { padding: { bottom: 30, left: 5, right: 5 } },
                        plugins: { legend:{ display:false }, tooltip:{ enabled:true, backgroundColor:'rgba(9,9,11,0.95)', filter:(item) => item.datasetIndex === 0, callbacks:{ title: (c) => c[0].label.replace('#', ''), label:(c) => `Drawdown: ${c.parsed.y.toFixed(2)}%` } } },
                        scales: { x:{ display:false }, y:{ grid:{ color:'#383838' }, ticks:{ color:'#858585', font:{size:8, family:'monospace'}, padding: 10, callback:v=>v.toFixed(1)+'%' }, max:0 } }
                    }
                });
                isFirstDrawdownRender = false;

                // Position label immediately if no animation (after first render)
                if (!isFirstDrawdownRender) {
                    setTimeout(() => {
                        const maxDDLabel = document.getElementById('max-drawdown-label');
                        
                        if (drawdownChartInstance && drawdownChartInstance.scales && drawdownChartInstance.scales.y && drawdownChartInstance.chartArea) {
                            const yScale = drawdownChartInstance.scales.y;
                            const chartArea = drawdownChartInstance.chartArea;
                            
                            // Get pixel position for the max drawdown value (horizontal dashed line level)
                            const maxDDPixel = yScale.getPixelForValue(chartMaxDrawdown);
                            
                            // Position label above the horizontal dashed line on the right side
                            maxDDLabel.style.display = 'block';
                            maxDDLabel.style.top = (chartArea.top + maxDDPixel - 12) + 'px';
                            maxDDLabel.style.left = 'auto';
                            maxDDLabel.style.right = '5px';
                            maxDDLabel.style.transform = 'none';
                            maxDDLabel.textContent = chartMaxDrawdown.toFixed(2) + '%';
                        } else {
                            maxDDLabel.style.display = 'none';
                        }
                    }, 50);
                }
            }

            // ============================================================
            // INSTITUTION METRICS ENGINE (adapted from ROWRIC backtest auditor)
            // Runs on live processedList — heavy (Monte Carlo), so only on 15s cycle
            // ============================================================
