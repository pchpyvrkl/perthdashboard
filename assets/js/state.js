            let rawCSVData = [];
            let processedList = [];      // full processed transaction/trade list (cached)
            let filteredProcessedList = []; // filtered transaction/trade list (date range)
            let cachedTotalDeposits = 0;
            let cachedTotalWithdrawals = 0;
            let dateFilterEnabled = false;
            let dateFilterFrom = null;
            let dateFilterTo = null;
            let chartInstance = null, drawdownChartInstance = null, durationChartInstance = null;
            let attributionChartInstance = null, hourlyChartInstance = null, dailyPatternChartInstance = null, mcChartInstance = null;
            let drawdownDistributionChartInstance = null;
            let activeChartType = 'gain';
            let activePeriodMode = 'daily';
            let gainCalculationMethod = 'compounded';
            let portfolioDataChecksum = '';
            let financialPrivacyEnabled = false;
            let latestPortfolioBalance = NaN;
            let totalUnrealizedPL = 0;
            let sharedInitialDeposit = 10000;
            let sharedUnrealizedGainPercent = 0;
            let isFirstChartRender = true;
            let isFirstDrawdownRender = true;
            let currentOpenTrades = []; // Store current open positions for PDF export

            let columnMapping = { date:'', profit:'', balance:'', type:'', openDate:'', symbol:'', volume:'', openPrice:'', closePrice:'', magic:'' };
            let openTradeColumnMapping = { time:'', status:'', symbol:'', type:'', volume:'', openPrice:'', currentPrice:'', takeProfit:'', stopLoss:'', commission:'', swap:'', profit:'' };

            // ============================================================
            // SHARED UNREALIZED VALUE COMPUTATION
            // ============================================================
            function recomputeSharedUnrealized(list, totalDeposits) {
                sharedInitialDeposit = totalDeposits > 0 ? totalDeposits : (list.length > 0 ? list[0].balance : 10000);
                // Calculate unrealized as percentage of current balance (not initial deposit)
                const currentBalance = list.length > 0 ? list[list.length - 1].balance : sharedInitialDeposit;
                sharedUnrealizedGainPercent = currentBalance > 0 ? (totalUnrealizedPL / currentBalance) * 100 : 0;
            }

            // ============================================================
            // FINANCIAL PRIVACY TOGGLE
            // ============================================================
            function toggleFinancialPrivacy() {
                financialPrivacyEnabled = !financialPrivacyEnabled;
                
                // Update eye icon
                const eyeIcon = document.getElementById('privacy-eye-icon');
                if (financialPrivacyEnabled) {
                    eyeIcon.classList.remove('fa-eye');
                    eyeIcon.classList.add('fa-eye-slash');
                } else {
                    eyeIcon.classList.remove('fa-eye-slash');
                    eyeIcon.classList.add('fa-eye');
                }
                
                // Re-render all financial displays with current privacy state
                if (processedList.length > 0) {
                    updateDashboardMetrics(processedList, cachedTotalDeposits, cachedTotalWithdrawals);
                    populateHistoryTable(processedList);
                    computeInstitutionMetrics(processedList, cachedTotalDeposits);
                }

                // Refresh open positions to update unrealized P/L display
                const metricEl = document.getElementById('metric-unrealized-pl');
                if (metricEl && sharedUnrealizedGainPercent !== undefined) {
                    const percentageDisplay = !isNaN(sharedUnrealizedGainPercent) ? `(${sharedUnrealizedGainPercent >= 0 ? '+' : ''}${sharedUnrealizedGainPercent.toFixed(2)}%)` : '';
                    metricEl.textContent = financialPrivacyEnabled ? '$x.xx (x.xx%)' : `$${Math.abs(totalUnrealizedPL).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}${percentageDisplay}`;
                    metricEl.className = `metric-value ${totalUnrealizedPL >= 0 ? 'val-pos' : 'val-neg'}`;
                }
            }

            function formatFinancialValue(value, isCurrency = true) {
                if (isCurrency) {
                    return (value >= 0 ? '$' : '-$') + Math.abs(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                } else {
                    return value.toFixed(2) + '%';
                }
            }

            // ============================================================
            // LIVE MACRO RATES (Yahoo Finance via CORS proxies)
            // RFR  = US10Y yield  (^TNX)
            // BENCH= S&P 500 1Y return (^GSPC)
            // ============================================================
