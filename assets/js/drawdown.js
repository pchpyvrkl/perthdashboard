            function computeDrawdownDistribution(list) {
                const drawdowns = [];
                let runningPeakValue = 100; // Start with baseline of 100%
                
                list.forEach((item, idx) => {
                    if (item.isFunding) return; // Skip funding events
                    
                    const gain = idx === 0 ? 0 : item.gainPercent;
                    const currentValue = 100 + gain;
                    
                    // Update running peak (high water mark)
                    if (currentValue > runningPeakValue) runningPeakValue = currentValue;
                    
                    // Calculate drawdown for this order as percentage from peak
                    const ddPct = ((currentValue - runningPeakValue) / runningPeakValue) * 100;
                    
                    // Only include negative drawdowns (losses from peak)
                    if (ddPct < 0) {
                        drawdowns.push({
                            index: idx,
                            symbol: item.symbol || 'Unknown',
                            drawdown: ddPct,
                            date: item.date
                        });
                    }
                });
                
                return drawdowns;
            }

            function renderDrawdownDistribution(list) {
                const canvas = document.getElementById('drawdownDistributionChart');
                if (!canvas) return;
                
                // Use filtered list if date filter is enabled
                const effectiveList = dateFilterEnabled ? filteredProcessedList : list;
                
                // Use the same Risk of Ruin formula as the table
                // When date filter is enabled (specific period), exclude funding; when disabled (since start), include funding
                const trades = effectiveList.filter(item => dateFilterEnabled ? !item.isFunding : true);
                const winsCount = trades.filter(t => t.profit > 0).length;
                const lossesCount = trades.filter(t => t.profit < 0).length;
                
                if (trades.length === 0 || winsCount === 0 || lossesCount === 0) {
                    // No data or insufficient data
                    if (drawdownDistributionChartInstance) {
                        drawdownDistributionChartInstance.destroy();
                    }
                    return;
                }
                
                const winRate = winsCount / trades.length;
                const avgWinPct = trades.filter(t => t.profit > 0).reduce((s,t)=>s+t.tradeReturnPercent,0) / winsCount;
                const avgLossPct = Math.abs(trades.filter(t => t.profit < 0).reduce((s,t)=>s+t.tradeReturnPercent,0) / lossesCount);
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
                
                // Create cumulative distribution using Risk of Ruin formula
                const binSize = 0.5; // 0.5% bins
                const cumulativeData = [];
                const maxDrawdown = -100; // Go down to -100% capital loss
                
                for (let threshold = 0; threshold >= maxDrawdown; threshold -= binSize) {
                    const units = Math.abs(threshold) / (avgLossPct || 0.01);
                    let prob = Math.pow(root, units) * 100;
                    
                    cumulativeData.push({
                        threshold: threshold,
                        probability: prob
                    });
                }
                
                // Convert to arrays for Chart.js - use numeric x values for linear scale
                const xValues = cumulativeData.map(d => d.threshold);
                const yValues = cumulativeData.map(d => d.probability);
                
                // Find the threshold where probability drops below 5%
                let fivePercentThreshold = null;
                for (let i = 0; i < cumulativeData.length; i++) {
                    if (cumulativeData[i].probability < 5) {
                        fivePercentThreshold = cumulativeData[i].threshold;
                        break;
                    }
                }
                
                // Destroy existing chart
                if (drawdownDistributionChartInstance) {
                    drawdownDistributionChartInstance.destroy();
                }
                
                const ctx = canvas.getContext('2d');
                const datasets = [{
                    label: 'Probability of Capital Depletion',
                    data: xValues.map((x, i) => ({ x: x, y: yValues[i] })),
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHitRadius: 10
                }];
                
                // Add vertical line at 5% probability threshold
                if (fivePercentThreshold !== null) {
                    datasets.push({
                        label: '5% Probability Threshold',
                        data: [
                            { x: fivePercentThreshold, y: 0 },
                            { x: fivePercentThreshold, y: 100 }
                        ],
                        borderColor: '#00C853',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        order: 1
                    });
                }
                
                drawdownDistributionChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                enabled: true,
                                external: function(context) {
                                    // Custom tooltip to update the cursor value display
                                    const tooltipModel = context.tooltip;
                                    if (tooltipModel.opacity === 0) {
                                        document.getElementById('dd-cursor-value').textContent = '-';
                                        return;
                                    }
                                    
                                    const dataPoint = tooltipModel.dataPoints[0];
                                    if (dataPoint) {
                                        const ddThreshold = dataPoint.parsed.x.toFixed(1);
                                        const probability = dataPoint.parsed.y.toFixed(1);
                                        document.getElementById('dd-cursor-value').textContent = 
                                            `Capital Loss: ${Math.abs(ddThreshold)}% → Prob: ${probability}%`;
                                    }
                                },
                                callbacks: {
                                    title: (context) => {
                                        const dd = context[0].parsed.x.toFixed(1);
                                        return `Capital Loss: ${Math.abs(dd)}%`;
                                    },
                                    label: (context) => {
                                        return `Probability: ${context.parsed.y.toFixed(2)}%`;
                                    }
                                },
                                backgroundColor: 'rgba(9, 9, 11, 0.95)',
                                titleColor: '#f4f4f5',
                                bodyColor: '#a1a1aa',
                                borderColor: '#27272a',
                                borderWidth: 1
                            }
                        },
                        onHover: (event, elements) => {
                            event.native.target.style.cursor = elements.length ? 'crosshair' : 'default';
                        },
                        scales: {
                            x: {
                                type: 'linear',
                                display: true,
                                reverse: true,
                                grid: {
                                    color: 'rgba(39, 39, 42, 0.3)',
                                    drawBorder: false
                                },
                                ticks: {
                                    color: '#71717a',
                                    font: {
                                        size: 10
                                    },
                                    callback: (value) => value.toFixed(1) + '%',
                                    stepSize: 1
                                },
                                title: {
                                    display: true,
                                    text: 'Capital Loss %',
                                    color: '#52525b',
                                    font: {
                                        size: 9,
                                        weight: 'bold'
                                    }
                                }
                            },
                            y: {
                                display: true,
                                position: 'left',
                                grid: {
                                    color: 'rgba(39, 39, 42, 0.5)',
                                    drawBorder: false
                                },
                                ticks: {
                                    color: '#71717a',
                                    font: {
                                        size: 10
                                    },
                                    callback: (value) => value.toFixed(0) + '%'
                                },
                                title: {
                                    display: true,
                                    text: 'Probability of Worse DD %',
                                    color: '#52525b',
                                    font: {
                                        size: 9,
                                        weight: 'bold'
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // ============================================================
            // TRANSACTION LOG
            // ============================================================
