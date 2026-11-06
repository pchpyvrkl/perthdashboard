            function applyDateFilter() {
                const fromDateInput = document.getElementById('date-from').value;
                const toDateInput = document.getElementById('date-to').value;
                
                if (!fromDateInput && !toDateInput) {
                    alert('Please select at least one date for filtering');
                    return;
                }
                
                // Parse dd.mm.yyyy format
                const parseDateDMY = (dateStr) => {
                    if (!dateStr) return null;
                    const parts = dateStr.split('.');
                    if (parts.length !== 3) return null;
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
                    const year = parseInt(parts[2], 10);
                    const date = new Date(year, month, day);
                    return isNaN(date.getTime()) ? null : date;
                };
                
                dateFilterFrom = fromDateInput ? parseDateDMY(fromDateInput) : null;
                dateFilterTo = toDateInput ? parseDateDMY(toDateInput) : null;
                
                // Set end date to end of day
                if (dateFilterTo) {
                    dateFilterTo.setHours(23, 59, 59, 999);
                }
                
                dateFilterEnabled = true;
                filterByDateRange();
            }
            
            function clearDateFilter() {
                dateFilterEnabled = false;
                dateFilterFrom = null;
                dateFilterTo = null;
                document.getElementById('date-from').value = '';
                document.getElementById('date-to').value = '';

                // Hide all sections except overview sections
                const sectionsToHide = [
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
                    'report-generator-section',
                    'transactions-section',
                    'pl-activity-section'
                ];

                sectionsToHide.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                // Show overview sections
                const overviewSections = ['metrics-section', 'chart-section', 'open-trades-section', 'export-button-section'];
                overviewSections.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = '';
                });

                // Reset to full data
                filteredProcessedList = [...processedList];
                updateDashboardMetrics(filteredProcessedList, cachedTotalDeposits, cachedTotalWithdrawals);
                generateMonthlyReturns(filteredProcessedList);
                renderDrawdownHeatmap(filteredProcessedList);
                renderDrawdownDistribution(filteredProcessedList);
                populateHistoryTable(filteredProcessedList);
                renderChart(filteredProcessedList);
                computeInstitutionMetrics(filteredProcessedList, cachedTotalDeposits);
                setPLCalendarTimeframe('month');

                // Scroll to top for home experience
                document.getElementById('main-content').scrollTo({ top: 0, behavior: 'smooth' });
            }

            function scrollToTransactions() {
                // Hide all sections except transactions, holding period, factor attribution, monthly heatmap, and notional exposure
                const sectionsToHide = [
                    'metrics-section',
                    'chart-section',
                    'open-trades-section',
                    'institution-section',
                    'risk-assessment-section',
                    'temporal-section',
                    'risk-ruin-section',
                    'monte-carlo-section',
                    'drawdown-heatmap-section',
                    'rebate-section',
                    'report-generator-section',
                    'export-button-section',
                    'pl-activity-section'
                ];

                sectionsToHide.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                // Show portfolio sections
                const portfolioSections = ['transactions-section', 'pl-activity-section', 'holding-section', 'factor-section', 'monthly-heatmap-section', 'notional-section', 'export-button-section'];
                portfolioSections.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = '';
                });

                // Scroll to transactions section
                const transactionsSection = document.getElementById('transactions-section');
                if (transactionsSection) {
                    transactionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            function scrollToRisk() {
                // Hide all sections except risk-related sections
                const sectionsToHide = [
                    'metrics-section',
                    'chart-section',
                    'open-trades-section',
                    'holding-section',
                    'factor-section',
                    'monthly-heatmap-section',
                    'notional-section',
                    'rebate-section',
                    'report-generator-section',
                    'export-button-section',
                    'transactions-section',
                    'monte-carlo-section',
                    'pl-activity-section'
                ];

                sectionsToHide.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                // Show risk sections
                const riskSections = ['institution-section', 'risk-assessment-section', 'temporal-section', 'risk-ruin-section', 'drawdown-heatmap-section', 'export-button-section'];
                riskSections.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = '';
                });

                // Scroll to first risk section
                const riskSection = document.getElementById('institution-section');
                if (riskSection) {
                    riskSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            function scrollToSimulation() {
                // Hide all sections except simulation section
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
                    'monthly-heatmap-section',
                    'drawdown-heatmap-section',
                    'notional-section',
                    'rebate-section',
                    'report-generator-section',
                    'export-button-section',
                    'transactions-section',
                    'pl-activity-section'
                ];

                sectionsToHide.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                // Show monte carlo section
                const monteCarloSection = document.getElementById('monte-carlo-section');
                if (monteCarloSection) {
                    monteCarloSection.style.display = '';
                    monteCarloSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
            
            function filterByDateRange() {
                if (!dateFilterEnabled || !processedList.length) {
                    filteredProcessedList = [...processedList];
                    return;
                }
                
                filteredProcessedList = processedList.filter(item => {
                    const itemDate = item.date;
                    
                    // Check if item date is within range
                    if (dateFilterFrom && itemDate < dateFilterFrom) return false;
                    if (dateFilterTo && itemDate > dateFilterTo) return false;
                    
                    // Exclude funding/unrealized transactions when date filter is enabled
                    // "Since start" (no filter) includes deposits/withdrawals, but specific periods exclude them
                    if (item.isFunding) return false;
                    
                    return true;
                });
                
                // Recalculate cumulative metrics for filtered data
                recalculateFilteredMetrics();
                
                // Update dashboard with filtered data
                updateDashboardMetrics(filteredProcessedList, cachedTotalDeposits, cachedTotalWithdrawals);
                generateMonthlyReturns(filteredProcessedList);
                renderDrawdownHeatmap(filteredProcessedList);
                renderDrawdownDistribution(filteredProcessedList);
                populateHistoryTable(filteredProcessedList);
                renderChart(filteredProcessedList);
                computeInstitutionMetrics(filteredProcessedList, cachedTotalDeposits);
            }
            
            function recalculateFilteredMetrics() {
                if (!filteredProcessedList.length) return;
                
                // Recalculate cumulative gains for the filtered period
                let currentCumulativeTWR = 1.0;
                let currentCumulativeAdditive = 0.0;
                
                // Start from 0 gain for filtered period (no baseline adjustment)
                let baseGain = 0;
                
                filteredProcessedList.forEach((item, idx) => {
                    // Calculate cumulative gains: exclude funding when date filter is enabled, include when disabled
                    if (item.tradeReturnPercent !== undefined && !(dateFilterEnabled && item.isFunding)) {
                        const r = item.tradeReturnPercent / 100;
                        currentCumulativeTWR *= (1.0 + r);
                        currentCumulativeAdditive += (r * 100);
                    }
                    
                    // Adjust gain to be relative to filtered period start (starting from 0)
                    const currentGain = gainCalculationMethod === 'additive' 
                        ? currentCumulativeAdditive 
                        : (currentCumulativeTWR - 1.0) * 100;
                    
                    item.gainPercent = currentGain;
                });
            }

            // ============================================================
            // CORE PORTFOLIO ENGINE (Myfxbook-style TWR bookkeeping)
            // ============================================================
