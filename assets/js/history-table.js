            function populateHistoryTable(list) {
                const tbody = document.getElementById('transaction-rows');
                const countEl = document.getElementById('history-count');
                tbody.innerHTML = '';

                // Use filtered list if date filter is enabled
                const effectiveList = dateFilterEnabled ? filteredProcessedList : list;
                // When date filter is enabled (specific period), already filtered to exclude funding
                // When date filter is disabled (since start), show all including funding
                countEl.textContent = `${effectiveList.length} Entries`;
                const displayList = [...effectiveList].reverse();
                if (displayList.length === 0) { tbody.innerHTML = `<tr><td colspan="13" class="text-center py-8 text-terminalMuted font-sans">Awaiting data records...</td></tr>`; return; }

                // Calculate income statement metrics
                let totalVolume = 0;
                let totalGains = 0;
                let totalLosses = 0;
                let netProfit = 0;
                let winningTrades = 0;
                let losingTrades = 0;
                let totalTrades = 0;
                let longTrades = 0;
                let shortTrades = 0;
                let totalDeposits = 0;
                let totalWithdrawals = 0;
                let totalGainPercent = 0;
                let tradeCountForAvg = 0;

                displayList.forEach(item => {
                    const isFunding = item.isFunding;
                    let holdingTime = "—";
                    if (!isFunding && item.openDate && item.date && !isNaN(item.openDate.getTime()) && !isNaN(item.date.getTime())) {
                        let diffMs = Math.abs(item.date - item.openDate);
                        let days = Math.floor(diffMs / 86400000);
                        let hours = Math.floor((diffMs % 86400000) / 3600000);
                        let minutes = Math.floor((diffMs % 3600000) / 60000);
                        const parts = [];
                        if (days > 0) parts.push(`${String(days).padStart(2,'0')}D`);
                        if (hours > 0 || parts.length > 0) parts.push(`${String(hours).padStart(2,'0')}H`);
                        parts.push(`${String(minutes).padStart(2,'0')}M`);
                        holdingTime = parts.join(':');
                    }
                    let typeBadge = '';
                    if (isFunding) {
                        typeBadge = item.profit >= 0
                            ? `<span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">Deposit</span>`
                            : `<span class="bg-amber-500/10 text-terminalAmber border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">Withdrawals</span>`;
                    } else {
                        const tType = (item.type || '').toLowerCase();
                        if (tType.includes('buy') || tType.includes('long')) typeBadge = `<span class="bg-emerald-500/10 text-terminalGreen border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">LONG</span>`;
                        else if (tType.includes('sell') || tType.includes('short')) typeBadge = `<span class="bg-rose-500/10 text-terminalRed border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">SHORT</span>`;
                        else typeBadge = `<span class="bg-zinc-800 text-terminalText border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Trade</span>`;
                    }
                    let tradeGainText = '-';
                    if (!isFunding) tradeGainText = `${item.profit >= 0 ? '+' : ''}${item.tradeReturnPercent.toFixed(2)}%`;

                    // Calculate income statement metrics (only for trades, not funding)
                    if (!isFunding) {
                        totalVolume += item.volume || 0;
                        totalTrades++;
                        
                        // Count long/short trades
                        const tType = (item.type || '').toLowerCase();
                        if (tType.includes('buy') || tType.includes('long')) longTrades++;
                        else if (tType.includes('sell') || tType.includes('short')) shortTrades++;
                        
                        if (item.profit > 0) {
                            totalGains += item.profit;
                            winningTrades++;
                        } else if (item.profit < 0) {
                            totalLosses += Math.abs(item.profit);
                            losingTrades++;
                        }
                        netProfit += item.profit;
                        
                        // Accumulate gain percentage for average
                        if (item.tradeReturnPercent !== undefined) {
                            totalGainPercent += item.tradeReturnPercent;
                            tradeCountForAvg++;
                        }
                    } else {
                        // Calculate deposits and withdrawals
                        if (item.profit > 0) {
                            totalDeposits += item.profit;
                        } else {
                            totalWithdrawals += Math.abs(item.profit);
                        }
                    }

                    const row = document.createElement('tr');
                    row.className = "hover:bg-terminalPanel transition-colors";
                    row.innerHTML = `
                        <td class="px-4 py-2 text-terminalMuted font-mono text-[11px]">${item.rawOpenDate || item.rawDate}</td>
                        <td class="px-4 py-2 text-terminalMuted font-mono text-[11px]">${item.rawDate}</td>
                        <td class="px-4 py-2 text-terminalText font-bold">${item.symbol || '—'}</td>
                        <td class="px-4 py-2">${typeBadge}</td>
                        <td class="px-4 py-2 text-right font-mono text-[11px]">${item.volume ? item.volume.toFixed(2) : '—'}</td>
                        <td class="px-4 py-2 text-right font-mono text-[11px]">${item.openPrice ? item.openPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:5}) : '—'}</td>
                        <td class="px-4 py-2 text-right font-mono text-[11px]">${item.closePrice ? item.closePrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:5}) : '—'}</td>
                        <td class="px-4 py-2 text-right font-bold ${item.profit >= 0 ? 'text-terminalGreen' : 'text-terminalRed'}">${item.profit >= 0 ? '+' : ''}$${item.profit.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td class="px-4 py-2 text-right font-bold ${item.profit >= 0 ? 'text-terminalGreen' : 'text-terminalRed'}">${tradeGainText}</td>
                        <td class="px-4 py-2 text-right text-zinc-400 font-mono text-[11px]">${item.commission ? '$' + item.commission.toFixed(2) : '—'}</td>
                        <td class="px-4 py-2 text-right text-zinc-400 font-mono text-[11px]">${item.swap ? '$' + item.swap.toFixed(2) : '—'}</td>
                        <td class="px-4 py-2 text-right text-terminalMuted font-mono text-[11px]">${item.magic || '—'}</td>
                        <td class="px-4 py-2 text-right font-mono text-zinc-300 text-[11px]">${holdingTime}</td>
                    `;
                    tbody.appendChild(row);
                });

                // Update income statement summary
                const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(1) : '0.0';
                const profitFactor = totalLosses > 0 ? (totalGains / totalLosses).toFixed(2) : (totalGains > 0 ? '∞' : '0.00');
                const avgGainPercent = tradeCountForAvg > 0 ? (totalGainPercent / tradeCountForAvg).toFixed(2) : '0.00';

                document.getElementById('income-total-trades').textContent = totalTrades;
                document.getElementById('income-long-trades').textContent = longTrades;
                document.getElementById('income-short-trades').textContent = shortTrades;
                document.getElementById('income-deposits').textContent = `$${totalDeposits.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                document.getElementById('income-withdrawals').textContent = `$${totalWithdrawals.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                document.getElementById('income-avg-gain').textContent = `${avgGainPercent}%`;
                document.getElementById('income-avg-gain').className = `font-bold ${avgGainPercent >= 0 ? 'text-terminalGreen' : 'text-terminalRed'}`;

                document.getElementById('income-total-volume').textContent = totalVolume.toFixed(2);
                document.getElementById('income-total-gains').textContent = `+$${totalGains.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                document.getElementById('income-total-losses').textContent = `-$${totalLosses.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                document.getElementById('income-net-profit').textContent = `${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                document.getElementById('income-net-profit').className = `font-bold ${netProfit >= 0 ? 'text-terminalGreen' : 'text-terminalRed'}`;
                document.getElementById('income-win-rate').textContent = `${winRate}%`;
                document.getElementById('income-profit-factor').textContent = profitFactor;
            }

            // ============================================================
            // RFR / BENCHMARK (live values — see fetchMarketMacroRates)
            // ============================================================
            // Cached base metrics (RFR-independent)
