            function populateAvailableMonths() {
                const select = document.getElementById('report-month');
                if (!select) return;
                
                // Clear existing options
                select.innerHTML = '<option value="">Select month...</option>';
                
                if (processedList.length === 0) return;
                
                // Get unique year-month combinations from data
                const monthSet = new Set();
                processedList.forEach(item => {
                    const year = item.date.getFullYear();
                    const month = item.date.getMonth() + 1; // 1-12
                    const key = `${year}-${month.toString().padStart(2, '0')}`;
                    monthSet.add(key);
                });
                
                // Convert to array and sort descending (most recent first)
                const sortedMonths = Array.from(monthSet).sort().reverse();
                
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                
                // Add options to select
                sortedMonths.forEach(key => {
                    const [year, month] = key.split('-').map(Number);
                    const monthName = monthNames[month - 1];
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${monthName} ${year}`;
                    select.appendChild(option);
                });
            }

            // ============================================================
            // MONTHLY REPORT GENERATOR
            // ============================================================
            async function generateMonthlyReport() {
                try {
                    const monthInput = document.getElementById('report-month').value;
                    if (!monthInput) {
                        alert('Please select a month for the report');
                        return;
                    }

                    const [year, month] = monthInput.split('-').map(Number);
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    const monthAbbrev = monthNames[month - 1].substring(0, 3).toUpperCase();

                    // Save current visibility state
                    const originalVisibility = {};
                    const allSections = [
                        'metrics-section', 'chart-section', 'open-trades-section',
                        'institution-section', 'risk-assessment-section',
                        'holding-section', 'temporal-section', 'factor-section',
                        'risk-ruin-section', 'monte-carlo-section',
                        'monthly-heatmap-section', 'drawdown-heatmap-section',
                        'notional-section', 'rebate-section',
                        'report-generator-section', 'export-button-section',
                        'transactions-section', 'pl-activity-section'
                    ];
                    
                    allSections.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            originalVisibility[id] = el.style.display;
                            el.style.display = 'none';
                        }
                    });

                    // Show only the sections we want in the report, in order
                    const sectionsToShow = ['metrics-section', 'chart-section', 'institution-section', 'risk-assessment-section', 'monthly-heatmap-section'];
                    
                    // Hide all sections first
                    allSections.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            originalVisibility[id] = el.style.display;
                            el.style.display = 'none';
                        }
                    });

                    // Show only the sections we want
                    sectionsToShow.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = '';
                    });

                    // Hide unwanted metric cards (NET PROFIT, BALANCE, UNREALIZED P/L)
                    const metricsContainer = document.getElementById('metrics-section');
                    if (metricsContainer) {
                        const metricCards = metricsContainer.querySelectorAll('.metric-card');
                        metricCards.forEach((card, index) => {
                            // Keep: GAIN (TWR) [0], MAX DRAWDOWN [3], CURRENT DD [4]
                            // Hide: NET PROFIT [1], BALANCE [2], UNREALIZED P/L [5]
                            if (index === 1 || index === 2 || index === 5) {
                                card.style.display = 'none';
                            }
                        });
                    }

                    // Apply date filter from start of portfolio to end of selected month
                    const originalDateFilter = { enabled: dateFilterEnabled, from: dateFilterFrom, to: dateFilterTo };
                    const startDate = null; // No start date = from beginning of portfolio
                    const endDate = new Date(year, month, 0, 23, 59, 59); // End of selected month
                    dateFilterEnabled = true;
                    dateFilterFrom = startDate;
                    dateFilterTo = endDate;
                    
                    // Apply the filter
                    filterByDateRange();
                    
                    // Wait for data to update
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Calculate metrics for the report summary
                    const calculateMetrics = (list) => {
                        const trades = list.filter(item => !item.isFunding);
                        if (trades.length === 0) return null;
                        
                        const finalGain = list[list.length - 1].gainPercent;
                        const firstDate = list[0].date;
                        const lastDate = list[list.length - 1].date;
                        
                        // Calculate drawdown series
                        let runningPeak = -Infinity;
                        const ddSeries = list.map((item, idx) => {
                            const gain = idx === 0 ? 0 : item.gainPercent;
                            const currentValue = 100 + gain;
                            if (currentValue > runningPeak) runningPeak = currentValue;
                            const drawdown = ((currentValue - runningPeak) / runningPeak) * 100;
                            return drawdown;
                        });
                        const maxDrawdown = Math.min(...ddSeries);
                        
                        // Calculate profit factor
                        const wins = trades.filter(t => t.profit > 0);
                        const losses = trades.filter(t => t.profit < 0);
                        const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
                        const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
                        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
                        
                        // Calculate Sharpe Ratio
                        const monthlyMap = {};
                        trades.forEach(t => {
                            const r = t.tradeReturnPercent / 100;
                            const mKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
                            monthlyMap[mKey] = (monthlyMap[mKey] === undefined ? 1 : monthlyMap[mKey]) * (1 + r);
                        });
                        const monthlyReturns = Object.values(monthlyMap).map(v => v - 1);
                        const avgMonthlyRet = monthlyReturns.reduce((a, b) => a + b, 0) / (monthlyReturns.length || 1);
                        const monthlyStd = Math.sqrt(monthlyReturns.reduce((sum, r) => sum + Math.pow(r - avgMonthlyRet, 2), 0) / (monthlyReturns.length || 1));
                        const monthlyRf = ANNUAL_RISK_FREE_RATE / 100 / 12;
                        const annSharpe = monthlyStd > 0 ? ((avgMonthlyRet - monthlyRf) / monthlyStd) * Math.sqrt(12) : 0;
                        
                        // Calculate recovery factor
                        const netProfit = trades.reduce((s, t) => s + t.profit, 0);
                        const maxDDCash = (maxDrawdown / 100) * (list[0].balance || 10000);
                        const recoveryFactor = Math.abs(maxDDCash) > 0 ? netProfit / Math.abs(maxDDCash) : 0;
                        
                        // Calculate CAGR
                        const durationYears = Math.max((lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25), 0.05);
                        const initialDeposit = list[0].balance || 10000;
                        const cagr = initialDeposit > 0 ? (Math.pow((initialDeposit + netProfit) / initialDeposit, 1 / durationYears) - 1) * 100 : 0;
                        
                        // Duration in months
                        const durationMonths = Math.floor(durationYears * 12);
                        
                        return {
                            return: finalGain,
                            maxDrawdown: maxDrawdown,
                            profitFactor: profitFactor,
                            tradeCount: trades.length,
                            sharpeRatio: annSharpe,
                            recoveryFactor: recoveryFactor,
                            cagr: cagr,
                            duration: durationMonths,
                            startDate: firstDate,
                            endDate: lastDate
                        };
                    };

                    // Calculate THIS MONTH metrics (actual monthly return, not cumulative)
                    const monthStart = new Date(year, month - 1, 1);
                    const monthEnd = new Date(year, month, 0, 23, 59, 59);
                    const thisMonthTrades = processedList.filter(item => !item.isFunding && item.date >= monthStart && item.date <= monthEnd);
                    
                    let thisMonthMetrics = null;
                    if (thisMonthTrades.length > 0) {
                        // Get balance at start of month
                        const beforeMonthData = processedList.filter(item => item.date < monthStart);
                        const startBalance = beforeMonthData.length > 0 ? beforeMonthData[beforeMonthData.length - 1].balance : (processedList[0]?.balance || 10000);
                        
                        // Calculate net profit for the month
                        const netProfit = thisMonthTrades.reduce((s, t) => s + t.profit, 0);
                        
                        // Calculate monthly return as percentage of starting balance
                        const monthlyReturn = startBalance > 0 ? (netProfit / startBalance) * 100 : 0;
                        
                        // Calculate drawdown for the month
                        let runningPeak = startBalance;
                        let maxDrawdown = 0;
                        thisMonthTrades.forEach(trade => {
                            const currentBalance = startBalance + netProfit; // Simplified - use running balance
                            if (currentBalance > runningPeak) runningPeak = currentBalance;
                            const dd = ((currentBalance - runningPeak) / runningPeak) * 100;
                            if (dd < maxDrawdown) maxDrawdown = dd;
                        });
                        
                        // Better drawdown calculation using gain%
                        let runningPeakGain = 0;
                        const ddSeries = thisMonthTrades.map((trade, idx) => {
                            const r = trade.tradeReturnPercent / 100;
                            const cumulativeFactor = thisMonthTrades.slice(0, idx + 1).reduce((prod, t) => prod * (1 + (t.tradeReturnPercent / 100)), 1);
                            const currentGain = (cumulativeFactor - 1) * 100;
                            if (currentGain > runningPeakGain) runningPeakGain = currentGain;
                            const currentValue = 100 + currentGain;
                            const peakValue = 100 + runningPeakGain;
                            const drawdown = ((currentValue - peakValue) / peakValue) * 100;
                            return drawdown;
                        });
                        maxDrawdown = Math.min(...ddSeries);
                        
                        // Calculate profit factor
                        const wins = thisMonthTrades.filter(t => t.profit > 0);
                        const losses = thisMonthTrades.filter(t => t.profit < 0);
                        const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
                        const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
                        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
                        
                        thisMonthMetrics = {
                            return: monthlyReturn,
                            maxDrawdown: maxDrawdown,
                            profitFactor: profitFactor,
                            tradeCount: thisMonthTrades.length,
                            sharpeRatio: 0, // Not meaningful for single month
                            recoveryFactor: 0, // Not meaningful for single month
                            cagr: 0, // Not meaningful for single month
                            duration: 1,
                            startDate: monthStart,
                            endDate: monthEnd
                        };
                    }

                    // Calculate YTD metrics (Jan 1 to selected month)
                    const ytdStart = new Date(year, 0, 1);
                    const ytdData = processedList.filter(item => item.date >= ytdStart && item.date <= monthEnd);
                    const ytdMetrics = calculateMetrics(ytdData);

                    // Calculate OVERALL metrics (start to selected month)
                    const overallMetrics = calculateMetrics(filteredProcessedList);

                    // Format date range
                    const formatDate = (d) => {
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                    };

                    // Build the text summary
                    let summaryText = `MONTHLY PERFORMANCE REPORT | ${monthNames[month - 1].toUpperCase()} ${year}\n\n`;
                    
                    if (thisMonthMetrics) {
                        summaryText += `THIS MONTH\n`;
                        summaryText += `Return: ${thisMonthMetrics.return >= 0 ? '+' : ''}${thisMonthMetrics.return.toFixed(2)}%\n`;
                        summaryText += `Max Drawdown: ${thisMonthMetrics.maxDrawdown.toFixed(2)}%\n`;
                        summaryText += `Profit Factor: ${isFinite(thisMonthMetrics.profitFactor) ? thisMonthMetrics.profitFactor.toFixed(2) : '∞'}\n`;
                        summaryText += `Trade Count: ${thisMonthMetrics.tradeCount}\n\n`;
                    }
                    
                    if (ytdMetrics) {
                        summaryText += `YTD\n`;
                        summaryText += `Return: ${ytdMetrics.return >= 0 ? '+' : ''}${ytdMetrics.return.toFixed(2)}%\n`;
                        summaryText += `Max Drawdown: ${ytdMetrics.maxDrawdown.toFixed(2)}%\n`;
                        summaryText += `Profit Factor: ${isFinite(ytdMetrics.profitFactor) ? ytdMetrics.profitFactor.toFixed(2) : '∞'}\n`;
                        summaryText += `Sharpe Ratio: ${ytdMetrics.sharpeRatio.toFixed(2)}\n`;
                        summaryText += `Recovery Factor: ${ytdMetrics.recoveryFactor.toFixed(2)}\n`;
                        summaryText += `Trade Count: ${ytdMetrics.tradeCount}\n\n`;
                    }
                    
                    if (overallMetrics) {
                        summaryText += `OVERALL (${formatDate(overallMetrics.startDate)} - ${formatDate(overallMetrics.endDate)})\n`;
                        summaryText += `Duration: ${overallMetrics.duration} Months\n`;
                        summaryText += `Total Return: ${overallMetrics.return >= 0 ? '+' : ''}${overallMetrics.return.toFixed(2)}%\n`;
                        summaryText += `CAGR: ${overallMetrics.cagr.toFixed(2)}%\n`;
                        summaryText += `Max Drawdown: ${overallMetrics.maxDrawdown.toFixed(2)}%\n`;
                        summaryText += `Profit Factor: ${isFinite(overallMetrics.profitFactor) ? overallMetrics.profitFactor.toFixed(2) : '∞'}\n`;
                        summaryText += `Sharpe Ratio: ${overallMetrics.sharpeRatio.toFixed(2)}\n`;
                        summaryText += `Recovery Factor: ${overallMetrics.recoveryFactor.toFixed(2)}\n`;
                        summaryText += `Trade Count: ${overallMetrics.tradeCount}`;
                    }

                    // Copy to clipboard
                    navigator.clipboard.writeText(summaryText).then(() => {
                        console.log('Summary copied to clipboard');
                    }).catch(err => {
                        console.error('Failed to copy:', err);
                    });

                    // Show modal with the summary
                    const shouldContinue = confirm(
                        `Report Summary (copied to clipboard):\n\n${summaryText}\n\nClick OK to generate PNG report, or Cancel to abort.`
                    );
                    
                    if (!shouldContinue) {
                        // Restore and exit
                        dateFilterEnabled = originalDateFilter.enabled;
                        dateFilterFrom = originalDateFilter.from;
                        dateFilterTo = originalDateFilter.to;
                        if (dateFilterEnabled && processedList.length) {
                            filteredProcessedList = processedList.filter(item => {
                                const itemDate = item.date;
                                if (dateFilterFrom && itemDate < dateFilterFrom) return false;
                                if (dateFilterTo && itemDate > dateFilterTo) return false;
                                if (item.isFunding) return false;
                                return true;
                            });
                            recalculateFilteredMetrics();
                        } else {
                            filteredProcessedList = [...processedList];
                        }
                        updateDashboardMetrics(filteredProcessedList, cachedTotalDeposits, cachedTotalWithdrawals);
                        return;
                    }

                    // Scroll to top
                    document.getElementById('main-content').scrollTo({ top: 0, behavior: 'smooth' });

                    // Wait for DOM to update and charts to render
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Capture each section individually
                    const sectionCanvases = [];
                    for (const id of sectionsToShow) {
                        const section = document.getElementById(id);
                        if (section) {
                            // Use visible width instead of scrollable width to avoid capturing overflow
                            const contentWidth = section.offsetWidth;
                            const contentHeight = section.offsetHeight;
                            
                            const sectionCanvas = await html2canvas(section, {
                                backgroundColor: '#000000',
                                scale: 2,
                                useCORS: true,
                                logging: false,
                                allowTaint: true,
                                width: contentWidth,
                                height: contentHeight,
                                scrollX: 0,
                                scrollY: 0
                            });
                            sectionCanvases.push(sectionCanvas);
                        }
                    }

                    // Create a combined vertical canvas
                    const maxWidth = Math.max(...sectionCanvases.map(c => c.width));
                    const totalHeight = sectionCanvases.reduce((sum, c) => sum + c.height, 0);
                    const combinedCanvas = document.createElement('canvas');
                    combinedCanvas.width = maxWidth;
                    combinedCanvas.height = totalHeight;
                    const ctx = combinedCanvas.getContext('2d');
                    
                    // Fill background
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, maxWidth, totalHeight);
                    
                    // Draw each section vertically (top to bottom)
                    let yOffset = 0;
                    sectionCanvases.forEach(canvas => {
                        ctx.drawImage(canvas, 0, yOffset);
                        yOffset += canvas.height;
                    });

                    // Convert combined canvas to PNG blob
                    combinedCanvas.toBlob((blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `ROWRIC_Monthly_Report_${monthAbbrev}_${year}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 'image/png');

                    // Restore original visibility
                    allSections.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.style.display = originalVisibility[id] || '';
                        }
                    });

                    // Restore metric cards visibility
                    if (metricsContainer) {
                        const metricCards = metricsContainer.querySelectorAll('.metric-card');
                        metricCards.forEach(card => {
                            card.style.display = '';
                        });
                    }

                    // Restore original date filter state
                    dateFilterEnabled = originalDateFilter.enabled;
                    dateFilterFrom = originalDateFilter.from;
                    dateFilterTo = originalDateFilter.to;
                    
                    // Recalculate filtered data
                    if (dateFilterEnabled && processedList.length) {
                        filteredProcessedList = processedList.filter(item => {
                            const itemDate = item.date;
                            if (dateFilterFrom && itemDate < dateFilterFrom) return false;
                            if (dateFilterTo && itemDate > dateFilterTo) return false;
                            if (item.isFunding) return false;
                            return true;
                        });
                        recalculateFilteredMetrics();
                    } else {
                        filteredProcessedList = [...processedList];
                    }
                    
                    // Update UI with restored data
                    updateDashboardMetrics(filteredProcessedList, cachedTotalDeposits, cachedTotalWithdrawals);
                    generateMonthlyReturns(filteredProcessedList);
                    renderDrawdownHeatmap(filteredProcessedList);
                    renderDrawdownDistribution(filteredProcessedList);
                    populateHistoryTable(filteredProcessedList);
                    renderChart(filteredProcessedList);
                    computeInstitutionMetrics(filteredProcessedList, cachedTotalDeposits);

                } catch (error) {
                    console.error('Error generating monthly report:', error);
                    alert('Error generating monthly report: ' + error.message);
                    
                    // Restore visibility on error
                    const allSections = [
                        'metrics-section', 'chart-section', 'open-trades-section',
                        'institution-section', 'risk-assessment-section',
                        'holding-section', 'temporal-section', 'factor-section',
                        'risk-ruin-section', 'monte-carlo-section',
                        'monthly-heatmap-section', 'drawdown-heatmap-section',
                        'notional-section', 'rebate-section',
                        'report-generator-section', 'export-button-section',
                        'transactions-section', 'pl-activity-section'
                    ];
                    allSections.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = '';
                    });
                }
            }

            // ============================================================
            // SHOW MONTHLY REPORT GENERATOR
            // ============================================================
            function showMonthlyReportGenerator() {
                // Hide all sections except report generator
                const sectionsToHide = [
                    'metrics-section',
                    'chart-section',
                    'open-trades-section',
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
                    'transactions-section',
                    'pl-activity-section'
                ];

                sectionsToHide.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                // Show report generator section
                const reportGeneratorSection = document.getElementById('report-generator-section');
                if (reportGeneratorSection) {
                    reportGeneratorSection.style.display = '';
                    reportGeneratorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            // ============================================================
            // EXPORT TO PDF
            // ============================================================
            // ============================================================
            // EXPORT TRANSACTIONS HISTORY TO PDF (all rows, not just visible)
            // ============================================================
