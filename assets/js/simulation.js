            function runSimulation() {
                const numSims = parseInt(document.getElementById('simulation-sims').value);
                const initialDeposit = 10000; // Fixed at 10000
                
                if (isNaN(numSims) || numSims <= 0) {
                    alert('Please enter a valid number of simulations');
                    return;
                }

                console.log('Starting simulation with', numSims, 'sims and fixed deposit:', initialDeposit);

                // Get trades from current data
                const effectiveList = dateFilterEnabled ? filteredProcessedList : processedList;
                const trades = effectiveList.filter(item => !item.isFunding && item.profit !== undefined);

                console.log('Total trades found:', trades.length);

                if (trades.length === 0) {
                    alert('No trade data available for simulation');
                    return;
                }

                // Calculate return percentage for each trade if not present
                const tradesWithReturn = trades.map(item => {
                    if (item.tradeReturnPercent !== undefined) {
                        return { ...item, returnPct: item.tradeReturnPercent };
                    } else if (item.profit !== undefined && item.openPrice !== undefined && item.closePrice !== undefined) {
                        // Calculate return percentage from prices
                        const returnPct = ((item.closePrice - item.openPrice) / item.openPrice) * 100;
                        return { ...item, returnPct };
                    } else {
                        // Fallback: estimate from profit relative to a base (this is approximate)
                        const returnPct = (item.profit / initialDeposit) * 100;
                        return { ...item, returnPct };
                    }
                });

                console.log('Trades with return:', tradesWithReturn.length);

                // Run Monte Carlo with the fixed deposit and custom number of simulations
                runMonteCarlo(tradesWithReturn, initialDeposit, numSims);
            }

            function runMonteCarlo(trades, initialDeposit, numSims = 10000) {
                try {
                    console.log('Running Monte Carlo with', trades.length, 'trades, initial deposit:', initialDeposit, 'and', numSims, 'simulations');

                    if (trades.length === 0) {
                        console.error('No trades to simulate');
                        return;
                    }

                    const numTrades = trades.length;
                    const finalReturns = [], maxDrawdowns = [], maxStagnations = [];
                    let ruinCount = 0, profitableRuns = 0;
                    const stepDistributions = Array.from({length: numTrades + 1}, () => []);

                    for (let i = 0; i < numSims; i++) {
                        let balance = initialDeposit, runningMax = initialDeposit, maxDD = 0, currentStagnation = 0, maxStagnation = 0;
                        stepDistributions[0].push(0);
                        for (let j = 0; j < numTrades; j++) {
                            const randomTrade = trades[Math.floor(Math.random() * numTrades)];
                            // Proper compound gain: multiply by (1 + return percentage)
                            balance = balance * (1 + randomTrade.returnPct / 100);
                            if (balance > runningMax) runningMax = balance;
                            if (balance <= 0) { balance = 0; maxDD = 100; break; }
                            const dd = ((runningMax - balance) / runningMax) * 100;
                            if (dd > maxDD) maxDD = dd;
                            // Track stagnation (consecutive trades below running max)
                            if (balance < runningMax) {
                                currentStagnation++;
                            } else {
                                currentStagnation = 0;
                            }
                            maxStagnation = Math.max(maxStagnation, currentStagnation);
                            stepDistributions[j+1].push(((balance - initialDeposit) / initialDeposit) * 100);
                        }
                        const totalReturnPct = ((balance - initialDeposit) / initialDeposit) * 100;
                        finalReturns.push(totalReturnPct);
                        maxDrawdowns.push(maxDD);
                        maxStagnations.push(maxStagnation);
                        if (maxDD >= 99.9) ruinCount++;
                        if (totalReturnPct > 0) profitableRuns++;
                    }

                    const p5Path = [], p50Path = [], p95Path = [];
                    for (let j = 0; j <= numTrades; j++) {
                        const values = stepDistributions[j].sort((a,b)=>a-b);
                        p5Path.push(values[Math.floor(numSims*0.05)]);
                        p50Path.push(values[Math.floor(numSims*0.50)]);
                        p95Path.push(values[Math.floor(numSims*0.95)]);
                    }

                    finalReturns.sort((a,b)=>a-b);
                    maxDrawdowns.sort((a,b)=>a-b);
                    maxStagnations.sort((a,b)=>a-b);

                    const medianReturn = finalReturns[Math.floor(numSims*0.5)];
                    const worstReturn = finalReturns[Math.floor(numSims*0.05)];
                    const bestReturn = finalReturns[Math.floor(numSims*0.95)];
                    const medianDD = maxDrawdowns[Math.floor(numSims*0.5)];
                    const worstDD = maxDrawdowns[Math.floor(numSims*0.95)];
                    const medianStagnation = maxStagnations[Math.floor(numSims*0.5)];
                    const p95Stagnation = maxStagnations[Math.floor(numSims*0.95)];
                    const probProfit = (profitableRuns / numSims) * 100;
                    const bankruptcyRisk = (ruinCount / numSims) * 100;
                    const robustScore = Math.min(999, medianReturn / (worstDD || 1));

                    console.log('Simulation complete. Updating UI...');

                    document.getElementById('mc-sim-count').innerText = numSims.toLocaleString();
                    document.getElementById('mc-trade-count').innerText = numTrades.toLocaleString();

                    updateMonteCarloUI(medianReturn, worstReturn, bestReturn, medianDD, worstDD, medianStagnation, p95Stagnation, probProfit, bankruptcyRisk, robustScore);
                    renderMonteCarloChart(p5Path, p50Path, p95Path, numTrades);

                    console.log('Monte Carlo simulation finished successfully');
                } catch (error) {
                    console.error('Error in Monte Carlo simulation:', error);
                    alert('Error running simulation: ' + error.message);
                }
            }

            function updateMonteCarloUI(medianReturn, worstReturn, bestReturn, medianDD, worstDD, stagnation, p95Stag, probProfit, ruin, robust) {
                const varLoss = Math.max(0, -worstReturn);
                document.getElementById('mc-median-ret').innerText = medianReturn.toFixed(2) + "%";
                document.getElementById('mc-median-ret').className = `metric-value ${medianReturn >= 0 ? 'val-pos' : 'val-neg'}`;
                document.getElementById('mc-best-case').innerText = bestReturn.toFixed(2) + "%";
                document.getElementById('mc-range').innerText = (bestReturn / (Math.abs(worstReturn) || 1)).toFixed(1) + "x";
                document.getElementById('mc-tail-outcome').innerText = worstReturn.toFixed(2) + "%";
                document.getElementById('mc-tail-outcome').className = `metric-value ${worstReturn >= 0 ? 'val-pos' : 'val-neg'}`;
                document.getElementById('mc-worst-ret').innerText = (varLoss > 100 ? 100 : varLoss).toFixed(2) + "%";
                document.getElementById('mc-worst-ret').className = `metric-value ${varLoss > 0 ? 'val-neg' : 'val-neutral'}`;
                document.getElementById('mc-median-dd').innerText = medianDD.toFixed(2) + "%";
                document.getElementById('mc-worst-dd').innerText = worstDD.toFixed(2) + "%";
                document.getElementById('mc-stagnation').innerHTML = `${stagnation}<span class="text-xs text-terminalMuted ml-2">/ ${p95Stag}</span>`;
                document.getElementById('mc-prob-profit').innerText = probProfit.toFixed(2) + "%";
                document.getElementById('mc-prob-profit').className = `metric-value ${probProfit >= 50 ? 'val-pos' : 'val-neg'}`;
                document.getElementById('mc-ruin').innerText = ruin.toFixed(2) + "%";
                document.getElementById('mc-ruin').className = `metric-value ${ruin > 1 ? 'val-neg' : 'val-pos'}`;
                document.getElementById('mc-robust-score').innerText = robust.toFixed(2);
                document.getElementById('mc-robust-score').className = `metric-value ${robust >= 2 ? 'val-pos' : robust >= 1 ? 'val-neutral' : 'val-neg'}`;
            }

            function renderMonteCarloChart(p5, p50, p95, tradeCount) {
                const ctx = document.getElementById('mcChart').getContext('2d');
                if (mcChartInstance) mcChartInstance.destroy();
                const labels = Array.from({length: tradeCount + 1}, (_, i) => i);
                mcChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets: [
                        { label:'Highest Projection (95%)', data:p95, borderColor:'#00C853', borderWidth:2, pointRadius:0, tension:0.1, fill:false },
                        { label:'Median Expectancy', data:p50, borderColor:'#D6D6D6', borderWidth:2, pointRadius:0, tension:0.1, fill:false },
                        { label:'Lowest Projection (5%)', data:p5, borderColor:'#FF4545', borderWidth:2, pointRadius:0, tension:0.1, fill:false }
                    ] },
                    options: {
                        responsive:true, maintainAspectRatio:false, interaction:{ intersect:false, mode:'index' },
                        plugins: { legend:{ display:false }, tooltip:{ enabled:true, backgroundColor:'rgba(9,9,11,0.95)', padding:12, callbacks:{ label:(c)=>`${c.dataset.label}: ${c.parsed.y.toFixed(2)}%`, title:(c)=>`Trade Sequence: ${c[0].label}` } } },
                        scales: {
                            x: { grid:{ display:false }, ticks:{ color:'#52525b', font:{size:9} }, title:{ display:true, text:'SEQUENTIAL TRADES', color:'#52525b', font:{size:8,weight:'bold'} } },
                            y: { grid:{ color:'rgba(255,255,255,0.02)' }, ticks:{ color:'#71717a', font:{size:9}, callback:v=>v.toFixed(0)+'%' }, title:{ display:true, text:'PROJECTED YIELD (%)', color:'#52525b', font:{size:8,weight:'bold'} } }
                        }
                    }
                });
            }

            // ============================================================
            // POPULATE AVAILABLE MONTHS
            // ============================================================
