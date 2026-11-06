            async function exportTransactionsPDF() {
                try {
                    console.log('Starting PDF export...');
                    
                    if (processedList.length === 0) { 
                        alert('No transaction data to export.'); 
                        return; 
                    }
                    
                    console.log('Transaction data available:', processedList.length);
                    
                    const { jsPDF } = window.jspdf;
                    
                    if (!jsPDF) {
                        alert('jsPDF library not loaded. Please refresh the page.');
                        return;
                    }

                    // Calculate summary statistics - same logic as income statement
                    console.log('Calculating summary statistics...');
                    const effectiveList = dateFilterEnabled ? filteredProcessedList : processedList;
                    const tradeList = effectiveList.filter(item => !item.isFunding);

                    let pdfTotalVolume = 0;
                    let pdfTotalGains = 0;
                    let pdfTotalLosses = 0;
                    let pdfNetProfit = 0;
                    let pdfWinningTrades = 0;
                    let pdfLosingTrades = 0;
                    let pdfTotalTrades = 0;
                    let pdfLongTrades = 0;
                    let pdfShortTrades = 0;
                    let pdfTotalDeposits = 0;
                    let pdfTotalWithdrawals = 0;
                    let pdfTotalGainPercent = 0;
                    let pdfTradeCountForAvg = 0;
                    
                    tradeList.forEach(item => {
                        pdfTotalVolume += item.volume || 0;
                        pdfTotalTrades++;

                        const tType = (item.type || '').toLowerCase();
                        if (tType.includes('buy') || tType.includes('long')) pdfLongTrades++;
                        else if (tType.includes('sell') || tType.includes('short')) pdfShortTrades++;

                        if (item.profit > 0) {
                            pdfTotalGains += item.profit;
                            pdfWinningTrades++;
                        } else if (item.profit < 0) {
                            pdfTotalLosses += Math.abs(item.profit);
                            pdfLosingTrades++;
                        }
                        pdfNetProfit += item.profit;

                        if (item.tradeReturnPercent !== undefined) {
                            pdfTotalGainPercent += item.tradeReturnPercent;
                            pdfTradeCountForAvg++;
                        }
                    });

                    // Calculate deposits and withdrawals from funding transactions
                    effectiveList.forEach(item => {
                        if (item.isFunding) {
                            if (item.profit > 0) {
                                pdfTotalDeposits += item.profit;
                            } else {
                                pdfTotalWithdrawals += Math.abs(item.profit);
                            }
                        }
                    });

                    const totalCommission = tradeList.reduce((sum, item) => sum + (item.commission || 0), 0);
                    const totalSwap = tradeList.reduce((sum, item) => sum + (item.swap || 0), 0);
                    const winRate = pdfTotalTrades > 0 ? (pdfWinningTrades / pdfTotalTrades * 100).toFixed(2) : 0;

                    // Calculate Sharpe Ratio (uses live US10Y risk-free rate)
                    const tradeReturns = tradeList.filter(item => item.tradeReturnPercent !== undefined).map(item => item.tradeReturnPercent / 100);
                    let sharpeRatio = 0;
                    if (tradeReturns.length > 1) {
                        const avgReturn = tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
                        const stdDev = Math.sqrt(tradeReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / tradeReturns.length);
                        // More accurate annualization assuming daily trading
                        const annualizedReturn = avgReturn * Math.sqrt(252); // 252 trading days per year
                        const annualizedStdDev = stdDev * Math.sqrt(252);
                        sharpeRatio = annualizedStdDev > 0 ? (annualizedReturn - (ANNUAL_RISK_FREE_RATE / 100)) / annualizedStdDev : 0;
                    }
                    
                    console.log('Sharpe Ratio calculation:', { tradeReturnsLength: tradeReturns.length, sharpeRatio });
                    
                    console.log('Getting current metric values...');
                    // Get current metric values
                    const gainTWR = document.getElementById('metric-twr-gain').textContent;
                    const netProfit = document.getElementById('metric-net-profit').textContent;
                    const balance = document.getElementById('metric-balance').textContent;
                    const maxDrawdown = document.getElementById('metric-max-drawdown').textContent;
                    const currentDrawdown = document.getElementById('metric-current-drawdown').textContent;
                    const unrealizedPL = document.getElementById('metric-unrealized-pl').textContent;
                    
                    console.log('Metrics retrieved:', { gainTWR, netProfit, balance, maxDrawdown });
                    console.log('Chart instances:', { chartInstance: !!chartInstance, drawdownChartInstance: !!drawdownChartInstance });

                    // Create PDF with A4 portrait format
                    console.log('Creating PDF document...');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 15;
                const contentWidth = pageWidth - (margin * 2);
                
                let currentPage = 1;
                const totalPages = 3; // Summary page + transactions pages (estimated)

                // Helper function to add header
                function addHeader(pageNum) {
                    pdf.setFillColor(255, 255, 255);
                    pdf.rect(0, 0, pageWidth, 35, 'F');
                    
                    pdf.setTextColor(0, 0, 0);
                    pdf.setFontSize(12);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('ROWRIC', margin, 10);
                    
                    pdf.setFontSize(8);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('Institutional Portfolio Data Report', margin, 16);
                    
                    pdf.setFontSize(7);
                    pdf.text('Quantitative Trading System | Performance Analytics', margin, 21);
                    
                    pdf.setFontSize(7);
                    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 26);
                    
                    pdf.setFontSize(8);
                    pdf.text(`Page ${pageNum}`, pageWidth - margin, 10, { align: 'right' });
                    
                    pdf.setFontSize(7);
                    pdf.text('Confidential', pageWidth - margin, 16, { align: 'right' });
                    
                    pdf.setDrawColor(0, 0, 0);
                    pdf.setLineWidth(0.5);
                    pdf.line(margin, 35, pageWidth - margin, 35);
                }

                // Helper function to add footer
                function addFooter() {
                    pdf.setFillColor(255, 255, 255);
                    pdf.rect(0, pageHeight - 25, pageWidth, 25, 'F');
                    
                    pdf.setTextColor(0, 0, 0);
                    pdf.setFontSize(6);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('ROWRIC Quantitative Trading System', margin, pageHeight - 20);
                    pdf.text('Institutional Portfolio Data Report', margin, pageHeight - 14);
                    
                    pdf.setFontSize(6);
                    pdf.text('Document Classification: Confidential', pageWidth - margin, pageHeight - 20, { align: 'right' });
                    pdf.text('© ' + new Date().getFullYear() + ' ROWRIC. All rights reserved.', pageWidth - margin, pageHeight - 14, { align: 'right' });
                    
                    pdf.setDrawColor(0, 0, 0);
                    pdf.setLineWidth(0.5);
                    pdf.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
                }

                // Helper function to convert canvas to black and white
                function convertCanvasToBW(canvas) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const ctx = tempCanvas.getContext('2d');
                    ctx.drawImage(canvas, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const data = imageData.data;
                    
                    for (let i = 0; i < data.length; i += 4) {
                        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                        data[i] = avg;     // R
                        data[i + 1] = avg; // G
                        data[i + 2] = avg; // B
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    return tempCanvas.toDataURL('image/png');
                }

                // PAGE 1: EXECUTIVE SUMMARY
                addHeader(currentPage);
                
                let yPos = 45;
                
                // Title
                pdf.setTextColor(0, 0, 0);
                pdf.setFontSize(20);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Executive Summary', margin, yPos);
                yPos += 25;
                
                // Subtitle
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(80, 80, 80);
                pdf.text('Institution Risk & Return Analytics', margin, yPos);
                yPos += 20;
                
                // Performance Overview Section
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Performance Overview', margin, yPos);
                yPos += 8;
                
                // Performance metrics in 3-column grid
                const perfMetrics = [
                    { label: 'Total Return (TWR)', value: gainTWR },
                    { label: 'Net Profit/Loss', value: netProfit },
                    { label: 'Portfolio Value', value: balance },
                    { label: 'Unrealized P/L', value: unrealizedPL },
                    { label: 'Maximum Drawdown', value: maxDrawdown },
                    { label: 'Current Drawdown', value: currentDrawdown }
                ];
                
                const perfColWidth = contentWidth / 3;
                perfMetrics.forEach((metric, index) => {
                    const col = index % 3;
                    const row = Math.floor(index / 3);
                    const x = margin + (col * perfColWidth);
                    const y = yPos + (row * 14);
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(7);
                    pdf.setTextColor(80, 80, 80);
                    pdf.text(metric.label, x, y);
                    
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(10);
                    pdf.setTextColor(0, 0, 0);
                    pdf.text(metric.value, x, y + 5);
                });
                
                yPos += Math.ceil(perfMetrics.length / 3) * 14 + 12;
                
                // Trading Statistics Section
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Trading Statistics', margin, yPos);
                yPos += 8;
                
                // Trading metrics in 3-column grid
                const tradeMetrics = [
                    { label: 'Win Rate', value: `${winRate}%` },
                    { label: 'Total Transactions', value: pdfTotalTrades.toString() },
                    { label: 'Winning Trades', value: pdfWinningTrades.toString() },
                    { label: 'Losing Trades', value: pdfLosingTrades.toString() },
                    { label: 'Profit Factor', value: (pdfTotalLosses > 0 ? (pdfTotalGains / pdfTotalLosses).toFixed(2) : (pdfTotalGains > 0 ? '∞' : '0.00')) },
                    { label: 'Average Trade', value: pdfTotalTrades > 0 ? `$${(pdfNetProfit / pdfTotalTrades).toFixed(2)}` : '—' }
                ];
                
                tradeMetrics.forEach((metric, index) => {
                    const col = index % 3;
                    const row = Math.floor(index / 3);
                    const x = margin + (col * perfColWidth);
                    const y = yPos + (row * 14);
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(7);
                    pdf.setTextColor(80, 80, 80);
                    pdf.text(metric.label, x, y);
                    
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(10);
                    pdf.setTextColor(0, 0, 0);
                    pdf.text(metric.value, x, y + 5);
                });
                
                yPos += Math.ceil(tradeMetrics.length / 3) * 14 + 12;
                
                // Financial Summary Section
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Financial Summary', margin, yPos);
                yPos += 8;
                
                // Financial metrics in 3-column grid - matching income statement summary
                const avgGainPercent = pdfTradeCountForAvg > 0 ? (pdfTotalGainPercent / pdfTradeCountForAvg).toFixed(2) : '0.00';
                const netProfitAfterCosts = pdfNetProfit - totalCommission - totalSwap;

                const finMetrics = [
                    { label: 'Total Trades', value: pdfTotalTrades.toString() },
                    { label: 'Long Trades', value: pdfLongTrades.toString() },
                    { label: 'Short Trades', value: pdfShortTrades.toString() },
                    { label: 'Total Volume', value: pdfTotalVolume.toFixed(2) },
                    { label: 'Deposits', value: `$${pdfTotalDeposits.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
                    { label: 'Withdrawals', value: `$${pdfTotalWithdrawals.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
                    { label: 'Total Gains', value: `+$${pdfTotalGains.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
                    { label: 'Total Losses', value: `-$${pdfTotalLosses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
                    { label: 'Net Profit', value: `${pdfNetProfit >= 0 ? '+' : ''}$${pdfNetProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
                    { label: 'Avg % Gain', value: `${avgGainPercent}%` },
                    { label: 'Win Rate', value: `${winRate}%` },
                    { label: 'Profit Factor', value: (pdfTotalLosses > 0 ? (pdfTotalGains / pdfTotalLosses).toFixed(2) : (pdfTotalGains > 0 ? '∞' : '0.00')) }
                ];
                
                finMetrics.forEach((metric, index) => {
                    const col = index % 4;
                    const row = Math.floor(index / 4);
                    const x = margin + (col * (contentWidth / 4));
                    const y = yPos + (row * 12);
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(7);
                    pdf.setTextColor(80, 80, 80);
                    pdf.text(metric.label, x, y);
                    
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(10);
                    pdf.setTextColor(0, 0, 0);
                    pdf.text(metric.value, x, y + 5);
                });
                
                yPos += Math.ceil(finMetrics.length / 3) * 14 + 12;
                
                // Transaction Activity Summary
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(12);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Transaction Activity Summary', margin, yPos);
                yPos += 12;
                
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(60, 60, 60);
                pdf.text(`Total Recorded Transactions: ${processedList.length}`, margin, yPos);
                yPos += 8;
                pdf.text(`Trading Operations: ${pdfTotalTrades}`, margin, yPos);
                yPos += 8;
                pdf.text(`Capital Movements (Deposits/Withdrawals): ${effectiveList.filter(item => item.isFunding).length}`, margin, yPos);
                yPos += 8;
                pdf.text(`Current Open Positions: ${currentOpenTrades.length}`, margin, yPos);
                
                yPos += 15;
                
                // Risk Metrics Section
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Risk Metrics', margin, yPos);
                yPos += 8;
                
                // Risk metrics in 3-column grid
                const riskColWidth = contentWidth / 3;
                
                // Calculate average win and loss properly
                const avgWin = pdfWinningTrades > 0 ? (pdfTotalGains / pdfWinningTrades) : 0;
                const avgLoss = pdfLosingTrades > 0 ? (pdfTotalLosses / pdfLosingTrades) : 0;
                
                console.log('Sharpe Ratio calculated:', sharpeRatio);
                
                const riskMetrics = [
                    { label: 'Maximum Drawdown', value: maxDrawdown },
                    { label: 'Current Drawdown', value: currentDrawdown },
                    { label: 'Sharpe Ratio', value: sharpeRatio.toFixed(2) },
                    { label: 'Average Loss per Trade', value: pdfLosingTrades > 0 ? `$${avgLoss.toFixed(2)}` : '—' },
                    { label: 'Average Win per Trade', value: pdfWinningTrades > 0 ? `$${avgWin.toFixed(2)}` : '—' }
                ];
                
                riskMetrics.forEach((metric, index) => {
                    const col = index % 3;
                    const row = Math.floor(index / 3);
                    const x = margin + (col * riskColWidth);
                    const y = yPos + (row * 14);
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(7);
                    pdf.setTextColor(80, 80, 80);
                    pdf.text(metric.label, x, y);
                    
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(10);
                    pdf.setTextColor(0, 0, 0);
                    pdf.text(metric.value, x, y + 5);
                    
                    console.log('Rendering risk metric:', metric.label, metric.value);
                });
                
                yPos += Math.ceil(riskMetrics.length / 3) * 14 + 12;
                
                // Ensure page break before footer
                if (yPos > pageHeight - 60) {
                    addFooter();
                    currentPage++;
                    pdf.addPage();
                    addHeader(currentPage);
                    yPos = 50;
                }
                
                // Check if we have enough space for charts, if not move to new page
                if (yPos > 115) {
                    addFooter();
                    currentPage++;
                    pdf.addPage();
                    addHeader(currentPage);
                    yPos = 50;
                }
                
                // Temporarily switch to daily mode for chart capture
                console.log('Switching chart to daily mode for capture...');
                const originalPeriodMode = activePeriodMode;
                const originalChartType = activeChartType;
                activePeriodMode = 'daily';
                activeChartType = 'gain';
                
                // Re-render chart with daily mode
                console.log('Re-rendering chart...');
                renderChart(processedList);
                console.log('Chart re-rendered');
                
                // Add charts section
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Performance Analytics', margin, yPos);
                yPos += 10;
                
                // Capture equity chart
                console.log('Capturing equity chart...');
                const equityCanvas = document.getElementById('equityChart');
                if (equityCanvas && chartInstance) {
                    try {
                        console.log('Converting equity chart to black and white...');
                        const equityImgData = convertCanvasToBW(equityCanvas);
                        const equityChartWidth = contentWidth;
                        const equityChartHeight = 50;
                        pdf.addImage(equityImgData, 'PNG', margin, yPos, equityChartWidth, equityChartHeight);
                        yPos += equityChartHeight + 6;
                        
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(8);
                        pdf.setTextColor(0, 0, 0);
                        pdf.text('Equity Curve & Portfolio Gain (Daily)', margin, yPos);
                        yPos += 8;
                        console.log('Equity chart captured successfully');
                    } catch (e) {
                        console.error('Error capturing equity chart:', e);
                    }
                } else {
                    console.log('Equity chart canvas or instance not available');
                }
                
                // Capture drawdown chart
                const drawdownCanvas = document.getElementById('drawdownChart');
                if (drawdownCanvas && drawdownChartInstance) {
                    try {
                        const drawdownImgData = convertCanvasToBW(drawdownCanvas);
                        const drawdownChartWidth = contentWidth;
                        const drawdownChartHeight = 35;
                        pdf.addImage(drawdownImgData, 'PNG', margin, yPos, drawdownChartWidth, drawdownChartHeight);
                        yPos += drawdownChartHeight + 6;
                        
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(8);
                        pdf.setTextColor(0, 0, 0);
                        pdf.text('Underwater Return Profile (%)', margin, yPos);
                        yPos += 8;
                    } catch (e) {
                        console.log('Error capturing drawdown chart:', e);
                    }
                }
                
                // Restore original chart mode
                activePeriodMode = originalPeriodMode;
                activeChartType = originalChartType;
                renderChart(processedList);
                
                yPos += 5;
                
                // Add current positions section
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Current Positions', margin, yPos);
                yPos += 12;
                
                if (currentOpenTrades.length > 0) {
                    // Current positions table
                    const positionHeaders = ['Symbol', 'Type', 'Volume', 'Open Price', 'Current Price', 'Take Profit', 'Stop Loss', 'Profit', 'Commission', 'Swap', 'Holding Time'];
                    const positionColWidths = [15, 12, 12, 18, 18, 15, 15, 18, 15, 12, 18];
                    const positionTableWidth = positionColWidths.reduce((a, b) => a + b, 0);
                    
                    pdf.setFillColor(240, 240, 240);
                    pdf.rect(margin, yPos - 5, positionTableWidth, 8, 'F');
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(7);
                    pdf.setTextColor(0, 0, 0);
                    
                    let posHeaderX = margin;
                    positionHeaders.forEach((header, index) => {
                        pdf.text(header, posHeaderX + 2, yPos);
                        posHeaderX += positionColWidths[index];
                    });
                    
                    yPos += 10;
                    
                    currentOpenTrades.forEach((trade, idx) => {
                        // Check if we need a new page
                        if (yPos > pageHeight - 50) {
                            addFooter();
                            currentPage++;
                            pdf.addPage();
                            addHeader(currentPage);
                            yPos = 50;
                            
                            // Repeat table header
                            pdf.setFillColor(240, 240, 240);
                            pdf.rect(margin, yPos - 5, positionTableWidth, 8, 'F');
                            
                            pdf.setFont('helvetica', 'bold');
                            pdf.setFontSize(7);
                            pdf.setTextColor(0, 0, 0);
                            
                            posHeaderX = margin;
                            positionHeaders.forEach((header, index) => {
                                pdf.text(header, posHeaderX + 2, yPos);
                                posHeaderX += positionColWidths[index];
                            });
                            
                            yPos += 10;
                        }
                        
                        // Alternate row background
                        if (idx % 2 === 0) {
                            pdf.setFillColor(248, 248, 248);
                            pdf.rect(margin, yPos - 4, positionTableWidth, 7, 'F');
                        }
                        
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(6);
                        pdf.setTextColor(0, 0, 0);
                        
                        let holdingTime = '—';
                        if (trade.holdingMs) {
                            const days = Math.floor(trade.holdingMs / 86400000);
                            const hours = Math.floor((trade.holdingMs % 86400000) / 3600000);
                            const minutes = Math.floor((trade.holdingMs % 3600000) / 60000);
                            holdingTime = `${String(days).padStart(2,'0')}D:${String(hours).padStart(2,'0')}H:${String(minutes).padStart(2,'0')}M`;
                        }
                        
                        let posCellX = margin;
                        const posCells = [
                            trade.symbol,
                            trade.type,
                            trade.volume,
                            trade.openPrice,
                            trade.currentPrice,
                            trade.takeProfit || '—',
                            trade.stopLoss || '—',
                            (trade.profit >= 0 ? '+' : '') + '$' + trade.profit.toFixed(2),
                            '$' + trade.commission.toFixed(2),
                            '$' + trade.swap.toFixed(2),
                            holdingTime
                        ];
                        
                        posCells.forEach((cell, index) => {
                            pdf.text(cell.substring(0, 12), posCellX + 2, yPos);
                            posCellX += positionColWidths[index];
                        });
                        
                        yPos += 7;
                    });
                    
                    // Add position summary
                    const totalPosVolume = currentOpenTrades.reduce((sum, t) => sum + parseFloat(t.volume) || 0, 0);
                    const totalPosProfit = currentOpenTrades.reduce((sum, t) => sum + t.profit, 0);
                    const totalPosCommission = currentOpenTrades.reduce((sum, t) => sum + t.commission, 0);
                    const totalPosSwap = currentOpenTrades.reduce((sum, t) => sum + t.swap, 0);
                    
                    yPos += 5;
                    pdf.setFillColor(230, 230, 230);
                    pdf.rect(margin, yPos - 4, positionTableWidth, 7, 'F');
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(6);
                    pdf.setTextColor(0, 0, 0);
                    
                    let summaryX = margin;
                    pdf.text('Summary', summaryX + 2, yPos);
                    summaryX += 40;
                    pdf.text('Vol: ' + totalPosVolume.toFixed(2), summaryX + 2, yPos);
                    summaryX += 30;
                    pdf.text('P/L: ' + (totalPosProfit >= 0 ? '+' : '') + '$' + totalPosProfit.toFixed(2), summaryX + 2, yPos);
                    summaryX += 30;
                    pdf.text('Comm: $' + totalPosCommission.toFixed(2), summaryX + 2, yPos);
                    summaryX += 30;
                    pdf.text('Swap: $' + totalPosSwap.toFixed(2), summaryX + 2, yPos);
                    
                    yPos += 10;
                } else {
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(8);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text('No current open positions', margin, yPos);
                    yPos += 10;
                }
                
                yPos += 5;
                
                // Add monthly return table - always start on new page
                addFooter();
                currentPage++;
                pdf.addPage();
                addHeader(currentPage);
                yPos = 50;
                
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Monthly Returns (%)', margin, yPos);
                yPos += 15;
                
                // Generate monthly return data
                const trades = processedList.filter(i => !i.isFunding && i.tradeReturnPercent !== undefined);
                if (trades.length > 0) {
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
                    
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const sortedYears = Object.keys(yearsMap).sort((a, b) => b - a);
                    
                    // Table header
                    const monthlyColWidth = 10;
                    const yearColWidth = 12;
                    const totalColWidth = 14;
                    const monthlyTableWidth = yearColWidth + (12 * monthlyColWidth) + totalColWidth;
                    
                    pdf.setFillColor(240, 240, 240);
                    pdf.rect(margin, yPos - 4, monthlyTableWidth, 7, 'F');
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(6);
                    pdf.setTextColor(0, 0, 0);
                    
                    let headerX = margin;
                    pdf.text('Year', headerX + 2, yPos);
                    headerX += yearColWidth;
                    
                    months.forEach(month => {
                        pdf.text(month, headerX + 2, yPos);
                        headerX += monthlyColWidth;
                    });
                    
                    pdf.text('Total', headerX + 2, yPos);
                    yPos += 9;
                    
                    // Table rows
                    sortedYears.forEach(year => {
                        // Check if we need a new page (more conservative threshold)
                        if (yPos > pageHeight - 35) {
                            addFooter();
                            currentPage++;
                            pdf.addPage();
                            addHeader(currentPage);
                            yPos = 50;
                            
                            // Repeat table header on new page
                            pdf.setFillColor(240, 240, 240);
                            pdf.rect(margin, yPos - 4, monthlyTableWidth, 7, 'F');
                            
                            pdf.setFont('helvetica', 'bold');
                            pdf.setFontSize(6);
                            pdf.setTextColor(0, 0, 0);
                            
                            let headerX = margin;
                            pdf.text('Year', headerX + 2, yPos);
                            headerX += yearColWidth;
                            
                            months.forEach(month => {
                                pdf.text(month, headerX + 2, yPos);
                                headerX += monthlyColWidth;
                            });
                            
                            pdf.text('Total', headerX + 2, yPos);
                            yPos += 9;
                        }
                        
                        // Alternate row background
                        const rowIndex = sortedYears.indexOf(year);
                        if (rowIndex % 2 === 0) {
                            pdf.setFillColor(248, 248, 248);
                            pdf.rect(margin, yPos - 3, monthlyTableWidth, 6, 'F');
                        }
                        
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(5);
                        pdf.setTextColor(0, 0, 0);
                        
                        let rowX = margin;
                        pdf.text(year, rowX + 2, yPos);
                        rowX += yearColWidth;
                        
                        let annualTotal = 0;
                        for (let m = 0; m < 12; m++) {
                            const val = yearsMap[year][m];
                            if (val === null) {
                                pdf.text('—', rowX + 2, yPos);
                            } else {
                                annualTotal += val;
                                pdf.text((val > 0 ? '+' : '') + val.toFixed(1) + '%', rowX + 2, yPos);
                            }
                            rowX += monthlyColWidth;
                        }
                        
                        pdf.setFont('helvetica', 'bold');
                        pdf.text((annualTotal > 0 ? '+' : '') + annualTotal.toFixed(1) + '%', rowX + 2, yPos);
                        yPos += 6;
                    });
                    
                    yPos += 5;
                }
                
                addFooter();
                
                // PAGE 2+: TRANSACTIONS TABLE
                currentPage++;
                pdf.addPage();
                addHeader(currentPage);
                
                yPos = 50;
                
                // Table title
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Complete Transaction Ledger', margin, yPos);
                yPos += 12;
                
                // Table headers
                const headers = ['In Time', 'Out Time', 'Symbol', 'Type', 'Volume', 'In Price', 'Out Price', 'Profit', 'Gain %', 'Commission', 'Swap', 'Magic', 'Holding Time'];
                const colWidths = [25, 25, 15, 12, 12, 18, 18, 18, 12, 15, 12, 12, 18];
                const tableWidth = colWidths.reduce((a, b) => a + b, 0);
                const startX = margin;
                const headerY = yPos;
                
                pdf.setFillColor(240, 240, 240);
                pdf.rect(startX, headerY - 5, tableWidth, 8, 'F');
                
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.setTextColor(0, 0, 0);
                
                let headerX = startX;
                headers.forEach((header, index) => {
                    pdf.text(header, headerX + 2, headerY);
                    headerX += colWidths[index];
                });
                
                yPos += 10;
                
                // Table rows
                const displayList = [...processedList].reverse();
                const rowHeight = 7;
                const maxRowsPerPage = Math.floor((pageHeight - 35 - 25 - 45) / rowHeight); // Account for header (35), footer (25), and margins (45)
                
                displayList.forEach((item, idx) => {
                    // Check if we need a new page
                    if (idx > 0 && idx % maxRowsPerPage === 0) {
                        addFooter();
                        currentPage++;
                        pdf.addPage();
                        addHeader(currentPage);
                        
                        yPos = 50;
                        
                        // Repeat table header on new page
                        pdf.setFillColor(240, 240, 240);
                        pdf.rect(startX, yPos - 5, tableWidth, 8, 'F');
                        
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(7);
                        pdf.setTextColor(0, 0, 0);
                        
                        headerX = startX;
                        headers.forEach((header, index) => {
                            pdf.text(header, headerX + 2, yPos);
                            headerX += colWidths[index];
                        });
                        
                        yPos += 10;
                    }
                    
                    const isFunding = item.isFunding;
                    let holdingTime = '—';
                    if (!isFunding && item.openDate && item.date && !isNaN(item.openDate.getTime()) && !isNaN(item.date.getTime())) {
                        const diffMs = Math.abs(item.date - item.openDate);
                        const days = Math.floor(diffMs / 86400000);
                        const hours = Math.floor((diffMs % 86400000) / 3600000);
                        const minutes = Math.floor((diffMs % 3600000) / 60000);
                        holdingTime = `${String(days).padStart(2,'0')}D:${String(hours).padStart(2,'0')}H:${String(minutes).padStart(2,'0')}M`;
                    }

                    let typeText = '—';
                    if (isFunding) {
                        typeText = item.profit >= 0 ? 'Deposit' : 'Withdrawal';
                    } else {
                        const t = (item.type || '').toLowerCase();
                        if (t.includes('buy') || t.includes('long')) typeText = 'LONG';
                        else if (t.includes('sell') || t.includes('short')) typeText = 'SHORT';
                        else typeText = 'Trade';
                    }

                    const gainText = !isFunding ? `${item.profit >= 0 ? '+' : ''}${item.tradeReturnPercent.toFixed(2)}%` : '—';
                    
                    // Alternate row background (black and white only)
                    if (idx % 2 === 0) {
                        pdf.setFillColor(248, 248, 248);
                        pdf.rect(startX, yPos - 4, tableWidth, rowHeight, 'F');
                    }
                    
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(6);
                    pdf.setTextColor(0, 0, 0);
                    
                    let cellX = startX;
                    const cells = [
                        item.rawOpenDate || item.rawDate,
                        item.rawDate,
                        item.symbol || '—',
                        typeText,
                        item.volume ? item.volume.toFixed(2) : '—',
                        item.openPrice ? item.openPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:5}) : '—',
                        item.closePrice ? item.closePrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:5}) : '—',
                        (item.profit >= 0 ? '+' : '') + '$' + item.profit.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}),
                        gainText,
                        item.commission ? '$'+item.commission.toFixed(2) : '—',
                        item.swap ? '$'+item.swap.toFixed(2) : '—',
                        item.magic || '—',
                        holdingTime
                    ];
                    
                    cells.forEach((cell, index) => {
                        pdf.setTextColor(0, 0, 0); // Black text for all columns
                        pdf.text(cell.substring(0, 15), cellX + 2, yPos); // Truncate long text
                        cellX += colWidths[index];
                    });
                    
                    yPos += rowHeight;
                });
                
                addFooter();
                
                console.log('PDF generation complete, saving file...');

                // Generate date range for filename
                const formatDate = (date) => {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const d = new Date(date);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = months[d.getMonth()];
                    const year = d.getFullYear();
                    return `${day}.${month}.${year}`;
                };

                const allDates = processedList.map(item => item.date).filter(d => d);
                const fromDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
                const toDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();

                const fileName = `ROWRIC Trading Transaction From ${formatDate(fromDate)} to ${formatDate(toDate)}.pdf`;
                console.log('Saving as:', fileName);
                pdf.save(fileName);
                console.log('PDF file saved successfully');
                
                } catch (error) {
                    console.error('Error during PDF export:', error);
                    alert('Error generating PDF: ' + error.message);
                }
            }

                    async function exportPDF() {
                try {
                    console.log('Starting PDF export...');
                    const { jsPDF } = window.jspdf;
                    
                    // Create a temporary container with only the sections we want to export
                    const tempContainer = document.createElement('div');
                    tempContainer.id = 'pdf-export-container';
                    tempContainer.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 1400px;
                        background: #000000;
                        padding: 0;
                        z-index: 10000;
                        overflow: visible;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    `;
                    
                    // Get the sections we want to include
                    const originalArea = document.getElementById('capture-area');
                    if (!originalArea) {
                        console.error('Could not find capture-area');
                        alert('Error: Could not find dashboard content');
                        return;
                    }
                    
                    // 1. Top Metric Cards (Gain TWR, Max Drawdown, Current Drawdown)
                    const metricCards = originalArea.querySelector('.grid.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-6');
                    if (metricCards) {
                        const cardsClone = metricCards.cloneNode(true);
                        cardsClone.style.marginBottom = '5px';
                        cardsClone.style.gap = '8px';
                        tempContainer.appendChild(cardsClone);
                    }
                    
                    // 2. Equity Curve & Portfolio Gain section - clone with chart canvas
                    const mainChartSection = originalArea.querySelector('.grid.grid-cols-1.gap-6');
                    if (mainChartSection) {
                        const chartClone = mainChartSection.cloneNode(true);
                        chartClone.style.marginBottom = '5px';
                        chartClone.style.width = '100%';
                        chartClone.style.gap = '5px';
                        
                        // Force chart containers to use full width
                        const chartContainers = chartClone.querySelectorAll('.relative');
                        chartContainers.forEach(container => {
                            container.style.width = '100%';
                        });
                        
                        // Copy chart canvas content manually with full width
                        const originalEquityCanvas = originalArea.querySelector('#equityChart');
                        const originalDrawdownCanvas = originalArea.querySelector('#drawdownChart');
                        const clonedEquityCanvas = chartClone.querySelector('#equityChart');
                        const clonedDrawdownCanvas = chartClone.querySelector('#drawdownChart');
                        
                        if (originalEquityCanvas && clonedEquityCanvas) {
                            // Set cloned canvas to full width
                            clonedEquityCanvas.style.width = '100%';
                            clonedEquityCanvas.style.maxWidth = '1400px';
                            const ctx = clonedEquityCanvas.getContext('2d');
                            ctx.drawImage(originalEquityCanvas, 0, 0, originalEquityCanvas.width, originalEquityCanvas.height, 0, 0, clonedEquityCanvas.width, clonedEquityCanvas.height);
                        }
                        if (originalDrawdownCanvas && clonedDrawdownCanvas) {
                            // Set cloned canvas to full width
                            clonedDrawdownCanvas.style.width = '100%';
                            clonedDrawdownCanvas.style.maxWidth = '1400px';
                            const ctx = clonedDrawdownCanvas.getContext('2d');
                            ctx.drawImage(originalDrawdownCanvas, 0, 0, originalDrawdownCanvas.width, originalDrawdownCanvas.height, 0, 0, clonedDrawdownCanvas.width, clonedDrawdownCanvas.height);
                        }
                        
                        tempContainer.appendChild(chartClone);
                    }
                    
                    // 3. Institution Risk & Return Analytics section
                    const institutionSection = Array.from(originalArea.children).find(child => 
                        child.querySelector && child.querySelector('h4') && 
                        child.querySelector('h4').textContent.includes('Institution Risk & Return Analytics')
                    );
                    if (institutionSection) {
                        const instClone = institutionSection.cloneNode(true);
                        instClone.style.marginBottom = '5px';
                        instClone.style.padding = '10px';
                        tempContainer.appendChild(instClone);
                    }
                    
                    // 4. Risk Assessment section (without input fields)
                    const riskSection = Array.from(originalArea.children).find(child => 
                        child.querySelector && child.querySelector('h4') && 
                        child.querySelector('h4').textContent.includes('Risk Assessment')
                    );
                    if (riskSection) {
                        const riskClone = riskSection.cloneNode(true);
                        // Remove the input controls section
                        const inputControls = riskClone.querySelector('.flex.items-center.gap-6.mt-5');
                        if (inputControls) {
                            inputControls.remove();
                        }
                        riskClone.style.marginBottom = '5px';
                        riskClone.style.padding = '10px';
                        tempContainer.appendChild(riskClone);
                    }
                    
                    // 5. Monthly Return Sheet section
                    const monthlySection = Array.from(originalArea.children).find(child => 
                        child.querySelector && child.querySelector('h4') && 
                        child.querySelector('h4').textContent.includes('Monthly Return Sheet')
                    );
                    if (monthlySection) {
                        const monthlyClone = monthlySection.cloneNode(true);
                        monthlyClone.style.padding = '10px';
                        tempContainer.appendChild(monthlyClone);
                    }
                    
                    // Add container to body temporarily
                    document.body.appendChild(tempContainer);
                    
                    console.log('Container created and added to DOM');
                    
                    // Wait for DOM to settle
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    console.log('Starting html2canvas capture...');
                    
                    // Capture the custom container
                    const canvas = await html2canvas(tempContainer, {
                        backgroundColor: '#000000',
                        scale: 2,
                        useCORS: true,
                        logging: true,
                        windowWidth: 1400,
                        scrollX: 0,
                        scrollY: 0,
                        allowTaint: true,
                        onclone: (clonedDoc) => {
                            const clonedContainer = clonedDoc.getElementById('pdf-export-container');
                            if (clonedContainer) {
                                clonedContainer.style.width = '1400px';
                                clonedContainer.style.overflow = 'visible';
                                clonedContainer.style.height = 'auto';
                            }
                        }
                    });
                    
                    console.log('Canvas captured successfully');
                    
                    const imgData = canvas.toDataURL('image/png', 1.0);
                    
                    // Calculate dimensions for A4 landscape
                    const pdfWidth = 297;
                    const pdfHeight = 210;
                    
                    const pdf = new jsPDF('l', 'mm', 'a4');
                    
                    // Set entire PDF background to black
                    pdf.setFillColor(0, 0, 0);
                    pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
                    
                    // Calculate image dimensions to fill the page
                    const imgWidth = pdfWidth;
                    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                    
                    let finalWidth = imgWidth;
                    let finalHeight = imgHeight;
                    let xOffset = 0;
                    let yOffset = 0;
                    
                    // Scale down if content is too tall
                    if (imgHeight > pdfHeight) {
                        const scale = pdfHeight / imgHeight;
                        finalWidth = imgWidth * scale;
                        finalHeight = pdfHeight;
                        xOffset = (pdfWidth - finalWidth) / 2; // Center horizontally
                    }
                    
                    pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

                    // Generate date range for filename
                    const formatDate = (date) => {
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const d = new Date(date);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = months[d.getMonth()];
                        const year = d.getFullYear();
                        return `${day}.${month}.${year}`;
                    };

                    const allDates = effectiveList.map(item => item.date).filter(d => d);
                    const fromDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
                    const toDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();

                    const fileName = `ROWRIC Trading Transaction From ${formatDate(fromDate)} to ${formatDate(toDate)}.pdf`;
                    pdf.save(fileName);

                    console.log('PDF saved successfully');
                    
                } catch (error) {
                    console.error('Error during PDF export:', error);
                    alert('Error generating PDF: ' + error.message);
                } finally {
                    // Remove temporary container
                    const tempContainer = document.getElementById('pdf-export-container');
                    if (tempContainer) {
                        document.body.removeChild(tempContainer);
                    }
                }
            }
