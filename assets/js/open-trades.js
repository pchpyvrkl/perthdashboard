            function isHTMLResponse(dataRows) {
                if (!Array.isArray(dataRows) || dataRows.length === 0) return false;
                const sample = dataRows[0];
                const text = Array.isArray(sample) ? sample.join(' ').toLowerCase() : Object.values(sample).join(' ').toLowerCase();
                return /<html|<!doctype|google drive|errormessage|cannot open file|ไม่สามารถเปิดไฟล์ได้ในเวลานี้/.test(text);
            }

            function autoDetectOpenTradeColumns(fields, sampleRow) {
                if (!fields || fields.length === 0) return;
                const normalize = (text) => String(text || '').toLowerCase().trim();
                const exactName = (name) => fields.find(h => normalize(h) === normalize(name));
                const findHeader = (aliases, exclude = []) => {
                    const normalizedExclude = exclude.map(e => normalize(e));
                    let found = aliases.map(a => exactName(a)).find(h => h);
                    if (found) return found;
                    found = fields.find(h => { const header = normalize(h); return aliases.some(alias => header === normalize(alias)) && !normalizedExclude.some(ex => header.includes(ex)); });
                    if (found) return found;
                    found = fields.find(h => { const header = normalize(h); return aliases.some(alias => header.includes(normalize(alias))) && !normalizedExclude.some(ex => header.includes(ex)); });
                    if (found) return found;
                    if (sampleRow) {
                        found = fields.find(h => { const sampleValue = normalize(sampleRow[h]); return aliases.some(alias => sampleValue.includes(normalize(alias))) && !normalizedExclude.some(ex => sampleValue.includes(ex)); });
                    }
                    return found || '';
                };
                openTradeColumnMapping.time = findHeader(['In Time', 'Open Time', 'Time', 'Date', 'Timestamp']);
                openTradeColumnMapping.status = findHeader(['Status', 'Position Status']);
                openTradeColumnMapping.symbol = findHeader(['Symbol', 'Pair', 'Market', 'Asset']);
                openTradeColumnMapping.type = findHeader(['Type', 'Order', 'Side', 'Action']);
                openTradeColumnMapping.volume = findHeader(['Volume', 'Size', 'Lots']);
                openTradeColumnMapping.openPrice = findHeader(['In Price', 'Open Price', 'Entry Price', 'Open Rate']);
                openTradeColumnMapping.currentPrice = findHeader(['Current Price', 'Close Price', 'Market Price', 'Last Price']);
                openTradeColumnMapping.takeProfit = findHeader(['Take Profit Price', 'Take Profit', 'TP', 'Target']);
                openTradeColumnMapping.stopLoss = findHeader(['Stop Loss Price', 'Stop Loss', 'SL', 'Stop Losses']);
                openTradeColumnMapping.commission = findHeader(['Commission', 'Comm']);
                openTradeColumnMapping.swap = findHeader(['Swap']);
                openTradeColumnMapping.profit = findHeader(['Profit', 'P&L', 'PnL', 'Gain', 'Net'], ['Take Profit']);
                if (fields.some(h => normalize(h) === 'current price')) openTradeColumnMapping.currentPrice = fields.find(h => normalize(h) === 'current price');
                if (fields.some(h => normalize(h) === 'profit')) openTradeColumnMapping.profit = fields.find(h => normalize(h) === 'profit');
                if (fields.some(h => normalize(h) === 'in price')) openTradeColumnMapping.openPrice = fields.find(h => normalize(h) === 'in price');
                if (fields.some(h => normalize(h) === 'take profit price')) openTradeColumnMapping.takeProfit = fields.find(h => normalize(h) === 'take profit price');
                if (fields.some(h => normalize(h) === 'stop loss price')) openTradeColumnMapping.stopLoss = fields.find(h => normalize(h) === 'stop loss price');
            }

            function formatDuration(ms) {
                if (isNaN(ms) || ms < 0) return '—';
                const totalSeconds = Math.floor(ms / 1000);
                const days = Math.floor(totalSeconds / 86400);
                const hours = Math.floor((totalSeconds % 86400) / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                const S = String(seconds).padStart(2,'0') + 'S';
                const M = String(minutes).padStart(2,'0') + 'M:';
                const H = String(hours).padStart(2,'0') + 'H:';
                const D = String(days).padStart(2,'0') + 'D:';
                if (days > 0)    return D + H + M + S;
                if (hours > 0)   return H + M + S;
                if (minutes > 0) return M + S;
                return S;
            }
            function formatDurationMinutes(mins) {
                if (isNaN(mins) || mins < 0) mins = 0;
                const d = Math.floor(mins / 1440);
                const h = Math.floor((mins % 1440) / 60);
                const m = Math.floor(mins % 60);
                if (d > 0) return `${d}d ${h}h`;
                if (h > 0) return `${h}h ${m}m`;
                return `${m}m`;
            }

            function parseOpenTradeDate(value) {
                if (!value) return null;
                let text = String(value).trim();
                text = text.replace(/\./g, '-').replace(/\s+/g, ' ');
                const hasTimezone = /([+-]\d{2}:?\d{2}|Z)$/i.test(text);
                let isoText = text;
                if (!hasTimezone) isoText = text.replace(' ', 'T') + '+03:00';
                let dt = new Date(isoText);
                if (isNaN(dt.getTime())) dt = new Date(text.replace(' ', 'T'));
                return isNaN(dt.getTime()) ? null : dt;
            }
            function parseNumberValue(value) {
                if (value === null || value === undefined) return NaN;
                const cleaned = String(value).replace(/\s+/g, '').replace(/,/g, '');
                return parseFloat(cleaned);
            }
            function findArrayHeaderIndex(headerRow, aliases) {
                if (!Array.isArray(headerRow)) return -1;
                const lower = headerRow.map(cell => String(cell || '').toLowerCase());
                return lower.findIndex(text => aliases.some(alias => text.includes(alias)));
            }
            function detectOpenTradeArrayIndices(headerRow) {
                return {
                    time: findArrayHeaderIndex(headerRow, ['open time','time','date','in time','datetime','timestamp']),
                    status: findArrayHeaderIndex(headerRow, ['status','position status']),
                    symbol: findArrayHeaderIndex(headerRow, ['symbol','pair','market','asset']),
                    type: findArrayHeaderIndex(headerRow, ['type','order','side','action']),
                    volume: findArrayHeaderIndex(headerRow, ['volume','size','lots']),
                    openPrice: findArrayHeaderIndex(headerRow, ['open price','entry price','open','price in','in price','open rate']),
                    takeProfit: findArrayHeaderIndex(headerRow, ['take profit','tp','target','target price','limit price']),
                    stopLoss: findArrayHeaderIndex(headerRow, ['stop loss','sl','stoploss','stop-loss','stop price']),
                    currentPrice: findArrayHeaderIndex(headerRow, ['current price','close price','price','close','current','market price','last price']),
                    commission: findArrayHeaderIndex(headerRow, ['commission','comm']),
                    swap: findArrayHeaderIndex(headerRow, ['swap']),
                    profit: findArrayHeaderIndex(headerRow, ['profit','p&l','pnl','gain','net'])
                };
            }

            function processOpenTrades(data) {
                let totalUnrealized = 0;
                const tbody = document.getElementById('open-transaction-rows');
                const countEl = document.getElementById('open-trades-count');
                const metricEl = document.getElementById('metric-unrealized-pl');
                if (!tbody) return;
                let trades = [];
                if (!data || data.length === 0) return;

                let arrayColumnMap = null;
                if (Array.isArray(data[0]) && data[0].some(cell => /symbol|open|close|price|volume|profit|type|commission|swap/i.test(String(cell || '')))) {
                    arrayColumnMap = detectOpenTradeArrayIndices(data[0]);
                }
                let totalVolume = 0, totalCommission = 0, totalSwap = 0;
                const getArrayValue = (row, idx, fallback) => (typeof idx === 'number' && idx >= 0) ? String(row[idx] || '').trim() : String(row[fallback] || '').trim();
                const isOpenPositionRow = (rowObj, statusIdx = -1) => {
                    let status = '';
                    if (statusIdx >= 0 && Array.isArray(rowObj)) status = String(rowObj[statusIdx] || '').trim();
                    if (!status && rowObj && typeof rowObj === 'object') status = String(rowObj[openTradeColumnMapping.status] || rowObj['Status'] || '').trim();
                    if (!status) return true;
                    status = status.toLowerCase();
                    return ['unrealized','open','active','running'].includes(status);
                };

                data.forEach((row, rowIndex) => {
                    let time = '', symbol = '', type = '', volume = '', openPrice = '', takeProfit = '', stopLoss = '', currentPrice = '';
                    let commission = 0, swap = 0, profitValue = 0;
                    let isArrayRow = Array.isArray(row);

                    if (isArrayRow) {
                        if (rowIndex === 0 && arrayColumnMap) return;
                        if (arrayColumnMap) {
                            if (!isOpenPositionRow(row, arrayColumnMap.status)) return;
                            time = getArrayValue(row, arrayColumnMap.time, 1);
                            symbol = getArrayValue(row, arrayColumnMap.symbol, 3);
                            type = getArrayValue(row, arrayColumnMap.type, 4);
                            volume = getArrayValue(row, arrayColumnMap.volume, 5);
                            openPrice = getArrayValue(row, arrayColumnMap.openPrice, 6);
                            takeProfit = getArrayValue(row, arrayColumnMap.takeProfit, 8);
                            stopLoss = getArrayValue(row, arrayColumnMap.stopLoss, 9);
                            currentPrice = getArrayValue(row, arrayColumnMap.currentPrice, 7);
                            commission = parseNumberValue(getArrayValue(row, arrayColumnMap.commission, 11)) || 0;
                            swap = parseNumberValue(getArrayValue(row, arrayColumnMap.swap, 12)) || 0;
                            profitValue = parseNumberValue(getArrayValue(row, arrayColumnMap.profit, 10)) || 0;
                        } else {
                            if (rowIndex === 0 && (String(row[3] || '').toLowerCase().includes('symbol') || !row[1])) return;
                            time = String(row[1] || '').trim(); symbol = String(row[3] || '').trim(); type = String(row[4] || '').trim();
                            volume = String(row[5] || '').trim(); openPrice = String(row[6] || '').trim(); currentPrice = String(row[7] || '').trim();
                            takeProfit = String(row[8] || '').trim(); stopLoss = String(row[9] || '').trim();
                            profitValue = parseNumberValue(row[10] || '0') || 0; commission = parseNumberValue(row[11] || '0') || 0; swap = parseNumberValue(row[12] || '0') || 0;
                        }
                    } else {
                        symbol = String(row[openTradeColumnMapping.symbol] || row['Symbol'] || '').trim();
                        if (!symbol) { if (rowIndex === 0) return; symbol = String(row[3] || '').trim(); }
                        if (!isOpenPositionRow(row)) return;
                        time = String(row[openTradeColumnMapping.time] || row['In Time'] || row['Time'] || row['Date'] || '').trim();
                        type = String(row[openTradeColumnMapping.type] || row['Type'] || row['Action'] || '').trim();
                        volume = String(row[openTradeColumnMapping.volume] || row['Volume'] || row['Size'] || row['Lots'] || '').trim();
                        openPrice = String(row[openTradeColumnMapping.openPrice] || row['In Price'] || row['Open Price'] || row['Open'] || row['Entry Price'] || '').trim();
                        takeProfit = String(row[openTradeColumnMapping.takeProfit] || row['Take Profit Price'] || row['TP'] || row['Take Profit'] || row['Target'] || '').trim();
                        stopLoss = String(row[openTradeColumnMapping.stopLoss] || row['Stop Loss Price'] || row['SL'] || row['Stop Loss'] || row['Stop- Loss'] || '').trim();
                        currentPrice = String(row[openTradeColumnMapping.currentPrice] || row['Current Price'] || row['Current'] || row['Close Price'] || row['Close'] || row['Price'] || row['Market Price'] || '').trim();
                        commission = parseNumberValue(row[openTradeColumnMapping.commission] || row['Commission'] || row['Comm'] || '0') || 0;
                        swap = parseNumberValue(row[openTradeColumnMapping.swap] || row['Swap'] || '0') || 0;
                        profitValue = parseNumberValue(row[openTradeColumnMapping.profit] || row['Profit'] || row['P&L'] || row['PnL'] || '0') || 0;
                    }

                    if (!symbol || symbol === '—' || symbol === '0' || symbol.toLowerCase().includes('symbol')) return;
                    const openDateObj = parseOpenTradeDate(time);
                    const holdingMs = openDateObj ? Date.now() - openDateObj.getTime() : null;
                    totalUnrealized += profitValue;
                    totalCommission += commission;
                    totalSwap += swap;
                    const volumeNum = parseFloat(String(volume).replace(/[^0-9.-]/g, '')) || 0;
                    totalVolume += volumeNum;
                    trades.push({ time, symbol, type, volume, openPrice, takeProfit, stopLoss, currentPrice, commission, swap, profit: profitValue, openDateObj, holdingMs });
                });

                // Store current open trades for PDF export
                currentOpenTrades = trades;

                totalUnrealizedPL = totalUnrealized;
                countEl.textContent = `${trades.length} Active`;
                metricEl.className = `metric-value ${totalUnrealized >= 0 ? 'val-pos' : 'val-neg'}`;

                // Refresh top cards on every live tick
                if (processedList.length > 0) {
                    recomputeSharedUnrealized(processedList, cachedTotalDeposits);
                    updateDashboardMetrics(processedList, cachedTotalDeposits, cachedTotalWithdrawals);
                    renderChart(processedList);
                    renderDrawdownHeatmap(processedList);
                }

                tbody.innerHTML = '';
                if (trades.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="13" class="text-center py-8 text-terminalMuted font-sans">No open positions detected.</td></tr>`;
                } else {
                    trades.forEach(t => {
                        const gainPercent = (!isNaN(latestPortfolioBalance) && latestPortfolioBalance !== 0) ? (t.profit / latestPortfolioBalance) * 100 : 0;
                        const gainDisplay = latestPortfolioBalance && !isNaN(latestPortfolioBalance) ? `${gainPercent >= 0 ? '+' : ''}${gainPercent.toFixed(2)}%` : '—';
                        const holdingText = formatDuration(t.holdingMs);
                        const row = document.createElement('tr');
                        row.className = "hover:bg-terminalPanel transition-colors";
                        const typeLabel = t.type.toLowerCase().includes('buy') ? 'LONG' : t.type.toLowerCase().includes('sell') ? 'SHORT' : t.type;
                        const typeColor = t.type.toLowerCase().includes('buy') ? 'text-terminalGreen' : 'text-terminalRed';
                        const profitDisplay = financialPrivacyEnabled ? '$x.xx' : `${t.profit >= 0 ? '+' : ''}$${t.profit.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                        row.innerHTML = `
                            <td class="px-4 py-2 text-terminalMuted font-mono text-[11px] col-open-time">${t.time}</td>
                            <td class="px-4 py-2 text-terminalText font-bold col-symbol">${t.symbol}</td>
                            <td class="px-4 py-2 col-type"><span class="text-[10px] font-bold uppercase ${typeColor}">${typeLabel}</span></td>
                            <td class="px-4 py-2 text-right font-mono text-[11px] col-volume">${t.volume}</td>
                            <td class="px-4 py-2 text-right font-mono text-[11px] col-open-price">${t.openPrice || '—'}</td>
                            <td class="px-4 py-2 text-right font-mono text-[11px] col-tp">${t.takeProfit || '—'}</td>
                            <td class="px-4 py-2 text-right font-mono text-[11px] col-sl">${t.stopLoss || '—'}</td>
                            <td class="px-4 py-2 text-right font-mono text-[11px] col-current-price">${t.currentPrice || '—'}</td>
                            <td class="px-4 py-2 text-right font-bold ${gainPercent >= 0 ? 'text-terminalGreen' : 'text-terminalRed'} col-gain">${gainDisplay}</td>
                            <td class="px-4 py-2 text-right text-zinc-400 font-mono text-[11px] col-commission">$${parseFloat(t.commission || 0).toFixed(2)}</td>
                            <td class="px-4 py-2 text-right text-zinc-400 font-mono text-[11px] col-swap">$${parseFloat(t.swap || 0).toFixed(2)}</td>
                            <td class="px-4 py-2 text-right font-bold ${t.profit >= 0 ? 'text-terminalGreen' : 'text-terminalRed'} col-profit">${profitDisplay}</td>
                            <td class="px-4 py-2 text-right font-mono text-[11px] col-holding">${holdingText}</td>
                        `;
                        tbody.appendChild(row);
                    });

                    const totalGainPercent = (!isNaN(latestPortfolioBalance) && latestPortfolioBalance !== 0) ? (totalUnrealized / latestPortfolioBalance) * 100 : NaN;
                    const totalGainDisplay = !isNaN(totalGainPercent) ? `${totalGainPercent >= 0 ? '+' : ''}${totalGainPercent.toFixed(2)}%` : '—';
                    if (metricEl) {
                        const plText = financialPrivacyEnabled ? '$x.xx (x.xx%)' : (!isNaN(totalGainPercent)
                            ? `$${Math.abs(totalUnrealized).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} (${totalGainPercent >= 0 ? '+' : ''}${totalGainPercent.toFixed(2)}%)`
                            : `$${Math.abs(totalUnrealized).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`);
                        metricEl.textContent = plText;
                    }

                    const summaryRow = document.createElement('tr');
                    summaryRow.className = "bg-zinc-900/80 text-terminalText font-semibold border-t border-terminalBorder";
                    const totalUnrealizedDisplay = financialPrivacyEnabled ? '$x.xx' : `$${Math.abs(totalUnrealized).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                    summaryRow.innerHTML = `
                        <td class="px-4 py-3 text-terminalText" colspan="3">Open Position Summary</td>
                        <td class="px-4 py-3 text-right font-mono text-[11px]">${totalVolume > 0 ? totalVolume.toFixed(2) : '—'}</td>
                        <td class="px-4 py-3"></td><td class="px-4 py-3"></td><td class="px-4 py-3"></td><td class="px-4 py-3"></td>
                        <td class="px-4 py-3 text-right font-bold ${totalGainPercent >= 0 ? 'text-terminalGreen' : 'text-terminalRed'}">${totalGainDisplay}</td>
                        <td class="px-4 py-3 text-right font-mono text-[11px]">$${totalCommission.toFixed(2)}</td>
                        <td class="px-4 py-3 text-right font-mono text-[11px]">$${totalSwap.toFixed(2)}</td>
                        <td class="px-4 py-3 text-right font-bold ${totalUnrealized >= 0 ? 'text-terminalGreen' : 'text-terminalRed'}">${totalUnrealizedDisplay}</td>
                        <td class="px-4 py-3"></td>
                    `;
                    tbody.appendChild(summaryRow);
                }
            }

            // ============================================================
            // CSV FETCH & PARSE (closed trade history — full 15s poll)
            // ============================================================
