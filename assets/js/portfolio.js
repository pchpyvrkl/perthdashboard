            function processPortfolio() {
                if (rawCSVData.length === 0) return;

                let mappedTransactions = [];
                const headers = Object.keys(rawCSVData[0]);
                const commissionHeader = headers.find(h => h.toLowerCase().includes('commission') || h.toLowerCase().includes('comm'));
                const swapHeader = headers.find(h => h.toLowerCase().includes('swap'));
                const taxesHeader = headers.find(h => h.toLowerCase().includes('tax'));

                rawCSVData.forEach((row, idx) => {
                    let rawDateStr = (row[columnMapping.date] || '').trim();
                    let rawOpenDateStr = (row[columnMapping.openDate] || '').trim();
                    if (!rawDateStr && rawOpenDateStr) rawDateStr = rawOpenDateStr;
                    if (!rawOpenDateStr) rawOpenDateStr = (row['Open Time'] || row['Open Date'] || row['Time'] || row['Date'] || rawDateStr).trim();

                    const parseRobust = (s) => {
                        if (!s) return new Date(NaN);
                        let clean = String(s).replace(/\./g, '-');
                        let obj = new Date(clean);
                        if (isNaN(obj.getTime())) obj = new Date(clean.replace(' ', 'T'));
                        return obj;
                    };

                    let profitVal = parseFloat((row[columnMapping.profit] || '0').replace(/[^0-9.-]/g, ''));
                    let balanceVal = columnMapping.balance ? parseFloat((row[columnMapping.balance] || '0').replace(/[^0-9.-]/g, '')) : NaN;
                    let typeStr = columnMapping.type ? (row[columnMapping.type] || '') : '';
                    let symbolVal = columnMapping.symbol ? (row[columnMapping.symbol] || '') : '';
                    let volumeVal = columnMapping.volume ? parseFloat((row[columnMapping.volume] || '0').replace(/[^0-9.]/g, '')) : 0;
                    let openPriceVal = columnMapping.openPrice ? parseFloat((row[columnMapping.openPrice] || '0').replace(/[^0-9.]/g, '')) : 0;
                    let closePriceVal = columnMapping.closePrice ? parseFloat((row[columnMapping.closePrice] || '0').replace(/[^0-9.]/g, '')) : 0;
                    let magicVal = columnMapping.magic ? (row[columnMapping.magic] || '') : '';
                    let commissionVal = commissionHeader ? parseFloat((row[commissionHeader] || '0').replace(/[^0-9.-]/g, '')) : 0;
                    let swapVal = swapHeader ? parseFloat((row[swapHeader] || '0').replace(/[^0-9.-]/g, '')) : 0;
                    let taxesVal = taxesHeader ? parseFloat((row[taxesHeader] || '0').replace(/[^0-9.-]/g, '')) : 0;

                    if (isNaN(profitVal)) profitVal = 0;
                    if (isNaN(balanceVal)) balanceVal = NaN;
                    if (isNaN(commissionVal)) commissionVal = 0;
                    if (isNaN(swapVal)) swapVal = 0;
                    if (isNaN(taxesVal)) taxesVal = 0;
                    if (!rawDateStr && profitVal === 0 && isNaN(balanceVal)) return;

                    let dateObj = parseRobust(rawDateStr);
                    if (isNaN(dateObj.getTime())) return;
                    let openDateObj = parseRobust(rawOpenDateStr);

                    let isFunding = false;
                    let rowValuesString = Object.values(row).map(v => String(v).toLowerCase()).join(' | ');
                    const fundingKeywords = ['deposit','withdraw','withdrawal','credit','transfer','funding','payout','pay-out','w/d','dep','with','bonus','rebate','adjustment'];
                    if (fundingKeywords.some(kw => rowValuesString.includes(kw))) isFunding = true;
                    for (let key in row) {
                        if (row.hasOwnProperty(key)) {
                            let val = String(row[key]).trim().toLowerCase();
                            if (val === 'balance' || val === 'deposit' || val === 'withdrawal' || val === 'with' || val === 'dep') isFunding = true;
                        }
                    }
                    let symbolHeader = headers.find(h => { const l = h.toLowerCase(); return l.includes('symbol') || l.includes('item') || l.includes('pair') || l.includes('market'); });
                    if (symbolHeader) {
                        let symVal = String(row[symbolHeader]).trim().toLowerCase();
                        if (!symVal || symVal === '0' || symVal === 'balance' || symVal === 'deposit' || symVal === 'withdrawal') isFunding = true;
                    }
                    let sizeHeader = headers.find(h => { const l = h.toLowerCase(); return l.includes('size') || l.includes('volume') || l.includes('lots'); });
                    if (sizeHeader) {
                        let sizeVal = parseFloat(String(row[sizeHeader]).replace(/[^0-9.]/g, ''));
                        if (isNaN(sizeVal) || sizeVal === 0) isFunding = true;
                    }

                    mappedTransactions.push({
                        index: idx, rawDate: rawDateStr, date: dateObj, rawOpenDate: rawOpenDateStr, openDate: openDateObj,
                        symbol: symbolVal, volume: volumeVal, openPrice: openPriceVal, closePrice: closePriceVal, magic: magicVal,
                        profit: profitVal, commission: commissionVal, swap: swapVal, taxes: taxesVal, providedBalance: balanceVal,
                        type: typeStr, isFunding: isFunding, rawRow: row
                    });
                });

                mappedTransactions.sort((a, b) => {
                    if (a.date.getTime() !== b.date.getTime()) return a.date - b.date;
                    if (a.isFunding && !b.isFunding) return -1;
                    if (!a.isFunding && b.isFunding) return 1;
                    return a.index - b.index;
                });

                let currentBalance = 0, totalDeposits = 0, totalWithdrawals = 0;
                let currentCumulativeTWR = 1.0, currentCumulativeAdditive = 0.0;
                let newProcessedList = [];

                mappedTransactions.forEach((tx, idx) => {
                    let isDepositOrWithdrawal = tx.isFunding;
                    let prevBalance = idx === 0 ? 0 : newProcessedList[idx - 1].balance;
                    let netTradeProfit = tx.profit;
                    if (!isDepositOrWithdrawal) netTradeProfit = tx.profit + tx.commission + tx.swap + tx.taxes;

                    if (idx === 0) {
                        currentBalance = !isNaN(tx.providedBalance) ? tx.providedBalance : tx.profit;
                        if (currentBalance >= 0) totalDeposits += currentBalance; else totalWithdrawals += Math.abs(currentBalance);
                        isDepositOrWithdrawal = true;
                        // Reset cumulative gains to 0 for the first transaction (baseline)
                        currentCumulativeTWR = 1.0;
                        currentCumulativeAdditive = 0.0;
                        // For the first transaction, adjust balance to remove any trading-related P/L
                        // to ensure it represents pure funding amount
                        if (!isDepositOrWithdrawal && netTradeProfit !== 0) {
                            currentBalance = currentBalance - netTradeProfit;
                        }
                    } else {
                        if (!isNaN(tx.providedBalance)) {
                            currentBalance = tx.providedBalance;
                            let balanceDiff = currentBalance - prevBalance;
                            let discrepancy = Math.abs(balanceDiff - netTradeProfit);
                            if (isDepositOrWithdrawal || discrepancy > 0.01) {
                                isDepositOrWithdrawal = true;
                                let externalFlow = balanceDiff - netTradeProfit;
                                if (externalFlow !== 0) { if (externalFlow > 0) totalDeposits += externalFlow; else totalWithdrawals += Math.abs(externalFlow); }
                                else { if (tx.profit >= 0) totalDeposits += tx.profit; else totalWithdrawals += Math.abs(tx.profit); }
                            }
                        } else {
                            currentBalance = prevBalance + netTradeProfit;
                            if (isDepositOrWithdrawal) { if (tx.profit >= 0) totalDeposits += tx.profit; else totalWithdrawals += Math.abs(tx.profit); }
                        }
                    }

                    let balanceBeforeTrade = currentBalance - netTradeProfit;
                    let tradeReturnPercent = 0;
                    if (!isDepositOrWithdrawal && balanceBeforeTrade > 0) {
                        let r = netTradeProfit / balanceBeforeTrade;
                        tradeReturnPercent = r * 100;
                        currentCumulativeTWR *= (1.0 + r);
                        currentCumulativeAdditive += (r * 100);
                    }
                    let currentGainPercent = gainCalculationMethod === 'additive' ? currentCumulativeAdditive : (currentCumulativeTWR - 1.0) * 100;
                    
                    // Force first transaction to 0% gain to establish proper baseline
                    if (idx === 0) {
                        currentGainPercent = 0;
                        tradeReturnPercent = 0;
                    }

                    newProcessedList.push({
                        date: tx.date, rawDate: tx.rawDate, openDate: tx.openDate, rawOpenDate: tx.rawOpenDate,
                        symbol: tx.symbol, volume: tx.volume, openPrice: tx.openPrice, closePrice: tx.closePrice, magic: tx.magic,
                        commission: tx.commission, swap: tx.swap, profit: tx.profit, netProfit: netTradeProfit, balance: currentBalance,
                        gainPercent: currentGainPercent, tradeReturnPercent: tradeReturnPercent, isFunding: isDepositOrWithdrawal, type: tx.type
                    });
                });

                processedList = newProcessedList;
                cachedTotalDeposits = totalDeposits;
                cachedTotalWithdrawals = totalWithdrawals;
                recomputeSharedUnrealized(processedList, totalDeposits);

                // Initialize filtered list with full data
                filteredProcessedList = [...processedList];
                
                // Apply date filter if enabled
                if (dateFilterEnabled) {
                    filterByDateRange();
                } else {
                    updateDashboardMetrics(processedList, totalDeposits, totalWithdrawals);
                    generateMonthlyReturns(processedList);
                    renderDrawdownHeatmap(processedList);
                    renderDrawdownDistribution(processedList);
                    populateHistoryTable(processedList);
                    renderChart(processedList);
                    computeInstitutionMetrics(processedList, totalDeposits);
                }
                
                // Populate available months for report generator
                populateAvailableMonths();

                // Initialize P/L calendar
                populateYearSelector();
                populateMonthSelector();
                setPLCalendarTimeframe('month');
                updateSPXBenchmarkMetric();
            }

            function getStandardDeviation(array) {
                const n = array.length;
                if (n < 2) return 0;
                const mean = array.reduce((a, b) => a + b) / n;
                return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / (n - 1));
            }

            // ============================================================
            // TOP-LEVEL DASHBOARD METRICS (fast, safe to run every 1s)
            // ============================================================
            function updateDashboardMetrics(list, totalDeposits, totalWithdrawals) {
                // Use filtered list if date filter is enabled, otherwise use full list
                const effectiveList = dateFilterEnabled ? filteredProcessedList : list;
                if (effectiveList.length === 0) return;
                const finalRow = effectiveList[effectiveList.length - 1];
                const finalGain = finalRow.gainPercent;
                const finalBalance = finalRow.balance;

                // Use shared initialDeposit and unrealizedGainPercent (computed once in recomputeSharedUnrealized)
                const initialDeposit = sharedInitialDeposit;
                const unrealizedGainPercent = sharedUnrealizedGainPercent;

                // Calculate final gain (chart now shows closed trades only)
                const lastIndex = effectiveList.length - 1;
                const chartFinalGain = lastIndex === 0 ? 0 : effectiveList[lastIndex].gainPercent;
                
                // Only include unrealized gains when date filter is NOT enabled
                const includeUnrealized = !dateFilterEnabled;
                const finalGainWithUnrealized = includeUnrealized ? chartFinalGain + unrealizedGainPercent : chartFinalGain;
                const finalBalanceWithUnrealized = includeUnrealized ? finalBalance + totalUnrealizedPL : finalBalance;

                // Combined gain formula: ((100 + % GAIN TWR) + % GAIN IN UNREALIZED P/L) - 100
                const combinedGain = includeUnrealized ? ((100 + chartFinalGain) + unrealizedGainPercent) - 100 : chartFinalGain;

                console.log('GAIN calculation - chartFinalGain:', chartFinalGain, 'unrealizedGainPercent:', unrealizedGainPercent, 'combinedGain:', combinedGain, 'totalUnrealizedPL:', totalUnrealizedPL, 'includeUnrealized:', includeUnrealized);

                let totalNetProfit = effectiveList.reduce((sum, item, idx) => (idx === 0 || item.isFunding) ? sum : sum + item.profit, 0) + (includeUnrealized ? totalUnrealizedPL : 0);

                const twrGainElement = document.getElementById('metric-twr-gain');
                twrGainElement.textContent = combinedGain.toFixed(2) + '%';
                // Update color class based on value
                twrGainElement.classList.remove('val-pos', 'val-neg', 'val-neutral');
                if (combinedGain > 0) {
                    twrGainElement.classList.add('val-pos');
                } else if (combinedGain < 0) {
                    twrGainElement.classList.add('val-neg');
                } else {
                    twrGainElement.classList.add('val-neutral');
                }
                document.getElementById('metric-net-profit').textContent = financialPrivacyEnabled ? '$xxxx.xx' : (totalNetProfit >= 0 ? '$' : '-$') + Math.abs(totalNetProfit).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
                document.getElementById('metric-balance').textContent = financialPrivacyEnabled ? '$xxxx.xx' : '$' + finalBalanceWithUnrealized.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
                document.getElementById('metric-deposits').textContent = 'Deposits: $' + totalDeposits.toLocaleString(undefined,{maximumFractionDigits:2});
                let roi = totalDeposits > 0 ? (totalNetProfit / totalDeposits) * 100 : 0;
                document.getElementById('metric-roi').textContent = `ROI: ${roi.toFixed(2)}%`;

                // ---- Max & Current Drawdown (using running peak like underwater chart) ----
                // Calculate drawdown series using running peak approach (same as underwater chart)
                let runningPeak = -Infinity;
                const ddSeries = effectiveList.map((item, idx) => {
                    const isLast = idx === effectiveList.length - 1;
                    // Add unrealized to the last point to match current drawdown calculation (only when date filter is NOT enabled)
                    const gainWithUnrealized = (isLast && includeUnrealized) ? item.gainPercent + unrealizedGainPercent : item.gainPercent;
                    if (gainWithUnrealized > runningPeak) runningPeak = gainWithUnrealized;
                    // Calculate drawdown as percentage from peak: (current - peak) / (100 + peak) * 100
                    const currentValue = 100 + gainWithUnrealized;
                    const peakValue = 100 + runningPeak;
                    const drawdown = ((currentValue - peakValue) / peakValue) * 100;
                    return parseFloat(drawdown.toFixed(2));
                });

                // Max drawdown is the minimum (most negative) value from the drawdown series
                const maxDrawdown = Math.min(...ddSeries);
                
                // Calculate max drawdown in cash terms (simple approach using max drawdown % and initial balance)
                const initialBalance = effectiveList.length > 0 ? effectiveList[0].balance : 10000;
                const maxDrawdownCash = (maxDrawdown / 100) * initialBalance;

                // Current drawdown is the last value from the drawdown series
                const currentDrawdown = ddSeries[ddSeries.length - 1];

                document.getElementById('metric-max-drawdown').textContent = maxDrawdown.toFixed(2) + '%';
                document.getElementById('metric-current-drawdown').textContent = currentDrawdown.toFixed(2) + '%';
                if (!isNaN(finalBalanceWithUnrealized)) latestPortfolioBalance = finalBalanceWithUnrealized;

                console.log('Max drawdown calculated:', maxDrawdown, 'current drawdown:', currentDrawdown, 'using running peak approach');
                console.log('Max drawdown cash calculated:', maxDrawdownCash);
                window.__latestMaxDrawdownPercent = maxDrawdown;
                window.__latestCurrentDrawdownPercent = currentDrawdown;
                window.__latestMaxDrawdownCash = maxDrawdownCash;
                window.__latestNetProfit = totalNetProfit;
                window.__latestInitialDeposit = initialDeposit;
                window.__latestFinalBalance = finalBalanceWithUnrealized;

                const trades = effectiveList.filter(item => !item.isFunding);
                const totalTrades = trades.length;
                const winningTrades = trades.filter(t => t.profit > 0);
                const losingTrades = trades.filter(t => t.profit < 0);
                const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
                let totalWinAmt = winningTrades.reduce((s, t) => s + t.profit, 0);
                let totalLossAmt = Math.abs(losingTrades.reduce((s, t) => s + t.profit, 0));
                const profitFactor = totalLossAmt > 0 ? (totalWinAmt / totalLossAmt) : totalWinAmt > 0 ? Infinity : 0;
                const avgWin = winningTrades.length > 0 ? totalWinAmt / winningTrades.length : 0;
                const avgLoss = losingTrades.length > 0 ? totalLossAmt / losingTrades.length : 0;

                let currentStreak = 0, maxStreak = 0;
                trades.forEach(t => { if (t.profit > 0) { currentStreak++; if (currentStreak > maxStreak) maxStreak = currentStreak; } else if (t.profit < 0) currentStreak = 0; });

                // Key Trading Performance box removed

                const monthlyGainsMap = {};
                let firstDate = null, lastDate = null;
                effectiveList.forEach(item => {
                    const y = item.date.getFullYear(), m = item.date.getMonth(), key = `${y}-${m}`;
                    monthlyGainsMap[key] = item.gainPercent;
                    if (!firstDate || item.date < firstDate) firstDate = item.date;
                    if (!lastDate || item.date > lastDate) lastDate = item.date;
                });
                if (firstDate && lastDate) {
                    const monthlyReturns = [];
                    let runningGain = 0, currY = firstDate.getFullYear(), currM = firstDate.getMonth();
                    const stopY = lastDate.getFullYear(), stopM = lastDate.getMonth();
                    while (currY < stopY || (currY === stopY && currM <= stopM)) {
                        const key = `${currY}-${currM}`;
                        const monthEndGain = monthlyGainsMap.hasOwnProperty(key) ? monthlyGainsMap[key] : runningGain;
                        monthlyReturns.push(monthEndGain - runningGain);
                        runningGain = monthEndGain;
                        currM++; if (currM > 11) { currM = 0; currY++; }
                    }
                    const rfr = ANNUAL_RISK_FREE_RATE;
                    if (monthlyReturns.length > 0) {
                        const avgMonthly = monthlyReturns.reduce((a,b) => a+b, 0) / monthlyReturns.length;
                        const monthlySD = getStandardDeviation(monthlyReturns);
                        const annualReturn = avgMonthly * 12;
                        const annualSD = monthlySD * Math.sqrt(12);
                        const sharpeRatio = annualSD > 0 ? (annualReturn - rfr) / annualSD : 0;
                        // stat-sharpe-ratio element removed (sidebar deleted)
                    }
                }
            }

            // ============================================================
            // MONTHLY RETURN HEATMAP
            // ============================================================
