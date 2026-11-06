            let plCalendarTimeframe = 'month';
            let plSelectedYear = null;
            let plSelectedMonth = null;

            function setPLCalendarTimeframe(timeframe) {
                plCalendarTimeframe = timeframe;

                // Update button states
                document.getElementById('pl-cal-month-btn').className = timeframe === 'month'
                    ? 'px-2 py-1 text-[10px] font-bold transition-all bg-terminalPanel text-terminalText border border-terminalAmber'
                    : 'px-2 py-1 text-[10px] font-bold transition-all text-terminalMuted hover:text-terminalText border border-terminalBorder';
                document.getElementById('pl-cal-year-btn').className = timeframe === 'year'
                    ? 'px-2 py-1 text-[10px] font-bold transition-all bg-terminalPanel text-terminalText border border-terminalAmber'
                    : 'px-2 py-1 text-[10px] font-bold transition-all text-terminalMuted hover:text-terminalText border border-terminalBorder';
                document.getElementById('pl-cal-total-btn').className = timeframe === 'total'
                    ? 'px-2 py-1 text-[10px] font-bold transition-all bg-terminalPanel text-terminalText border border-terminalAmber'
                    : 'px-2 py-1 text-[10px] font-bold transition-all text-terminalMuted hover:text-terminalText border border-terminalBorder';

                // Show/hide selectors
                const yearSelect = document.getElementById('pl-cal-year-select');
                const monthSelect = document.getElementById('pl-cal-month-select');
                yearSelect.style.display = timeframe === 'year' ? 'block' : 'none';
                monthSelect.style.display = timeframe === 'month' ? 'block' : 'none';

                // Initialize defaults
                const today = new Date();
                if (timeframe === 'month') {
                    if (plSelectedYear === null || plSelectedMonth === null) {
                        plSelectedYear = today.getFullYear();
                        plSelectedMonth = today.getMonth();
                    }
                    populateMonthSelector();
                } else if (timeframe === 'year') {
                    plSelectedYear = plSelectedYear || today.getFullYear();
                    plSelectedMonth = null;
                } else {
                    plSelectedYear = null;
                    plSelectedMonth = null;
                }

                generatePLCalendar();
                updatePLCalendar();
            }

            function selectPLCalendarYear(year) {
                plSelectedYear = parseInt(year);
                plSelectedMonth = null;
                generatePLCalendar();
                updatePLCalendar();
            }

            function selectPLCalendarMonth(value) {
                const [y, m] = value.split('-').map(Number);
                plSelectedYear = y;
                plSelectedMonth = m - 1;
                generatePLCalendar();
                updatePLCalendar();
            }

            function populateMonthSelector() {
                const monthSelect = document.getElementById('pl-cal-month-select');
                if (!monthSelect) return;

                const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                const monthSet = new Set();
                processedList.forEach(item => {
                    monthSet.add(`${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`);
                });
                const now = new Date();
                monthSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

                const sorted = Array.from(monthSet).sort().reverse();
                monthSelect.innerHTML = '';
                sorted.forEach(key => {
                    const [y, m] = key.split('-').map(Number);
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${monthNames[m - 1]} ${y}`;
                    monthSelect.appendChild(option);
                });

                const current = `${plSelectedYear}-${String((plSelectedMonth ?? now.getMonth()) + 1).padStart(2, '0')}`;
                monthSelect.value = monthSet.has(current) ? current : sorted[0];
            }

            function populateYearSelector() {
                const yearSelect = document.getElementById('pl-cal-year-select');
                if (!yearSelect) return;

                // Get all years from processed data
                const years = new Set();
                if (processedList.length > 0) {
                    processedList.forEach(item => {
                        years.add(item.date.getFullYear());
                    });
                }

                // Add current year if not present
                const currentYear = new Date().getFullYear();
                years.add(currentYear);

                // Sort years descending
                const sortedYears = Array.from(years).sort((a, b) => b - a);

                // Clear existing options
                yearSelect.innerHTML = '';

                // Add options
                sortedYears.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    yearSelect.appendChild(option);
                });

                // Set current selection
                if (plSelectedYear) {
                    yearSelect.value = plSelectedYear;
                } else {
                    yearSelect.value = currentYear;
                }

                // Initially hide the selector
                yearSelect.style.display = 'none';
            }

            function formatUTC7Date(date) {
                const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
                const utc7Date = new Date(utc + (3600000 * 7));
                const year = utc7Date.getFullYear();
                const month = String(utc7Date.getMonth() + 1).padStart(2, '0');
                const day = String(utc7Date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            function generatePLCalendar() {
                const calendar = document.getElementById('pl-activity-calendar');
                calendar.innerHTML = '';

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let startDate, endDate;

                switch (plCalendarTimeframe) {
                    case 'month':
                        if (plSelectedYear !== null && plSelectedMonth !== null) {
                            startDate = new Date(plSelectedYear, plSelectedMonth, 1);
                            endDate = new Date(plSelectedYear, plSelectedMonth + 1, 0);
                        } else {
                            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        }
                        break;
                    case 'year':
                        if (plSelectedYear !== null) {
                            startDate = new Date(plSelectedYear, 0, 1);
                            endDate = new Date(plSelectedYear, 11, 31);
                        } else {
                            startDate = new Date(today.getFullYear(), 0, 1);
                            endDate = new Date(today.getFullYear(), 11, 31);
                        }
                        break;
                    case 'total':
                        if (processedList.length > 0) {
                            const earliestDate = processedList.reduce((min, item) => item.date < min.date ? item : min).date;
                            startDate = new Date(earliestDate);
                        } else {
                            startDate = new Date(today);
                            startDate.setDate(today.getDate() - 30);
                        }
                        endDate = today;
                        break;
                    default:
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                }

                // Group by month (only include past or current dates, not future)
                const monthGroups = {};
                let currentDate = new Date(startDate);
                
                while (currentDate <= endDate) {
                    const compareDate = new Date(currentDate);
                    compareDate.setHours(0, 0, 0, 0);
                    
                    // Stop if we reach future dates
                    if (compareDate > endDate) break;
                    
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const key = `${year}-${month}`;
                    
                    if (!monthGroups[key]) {
                        monthGroups[key] = {
                            year,
                            month,
                            days: []
                        };
                    }
                    
                    monthGroups[key].days.push(new Date(currentDate));
                    currentDate.setDate(currentDate.getDate() + 1);
                }

                // Get sorted months (early to current)
                const sortedKeys = Object.keys(monthGroups).sort((a, b) => {
                    const [yearA, monthA] = a.split('-').map(Number);
                    const [yearB, monthB] = b.split('-').map(Number);
                    if (yearA !== yearB) return yearA - yearB;
                    return monthA - monthB;
                });
                
                // Create grid container
                const grid = document.createElement('div');
                grid.className = 'calendar-3x4-grid';
                
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

                // Show all months for year/total, last 3 months for month view
                const monthsToShow = plCalendarTimeframe === 'month' ? sortedKeys.slice(-3) : sortedKeys;
                
                monthsToShow.forEach(key => {
                    const group = monthGroups[key];
                    const columnDiv = document.createElement('div');
                    columnDiv.className = 'calendar-month-column';

                    // Month header
                    const header = document.createElement('div');
                    header.className = 'calendar-month-header';
                    
                    const monthLabel = document.createElement('div');
                    monthLabel.className = 'month-label';
                    monthLabel.textContent = monthNames[group.month];
                    header.appendChild(monthLabel);

                    const yearLabel = document.createElement('div');
                    yearLabel.className = 'year-label';
                    yearLabel.textContent = group.year;
                    header.appendChild(yearLabel);

                    // Calculate total percentage for this month (compound)
                    let monthCumulativeFactor = 1.0;
                    group.days.forEach(date => {
                        const dateStr = formatUTC7Date(date);
                        const dayTrades = processedList.filter(item => !item.isFunding && formatUTC7Date(item.date) === dateStr);
                        
                        if (dayTrades.length > 0) {
                            // Get balance at start of this day
                            const firstTradeBalance = dayTrades[0].balance - dayTrades[0].netProfit;
                            if (firstTradeBalance > 0) {
                                const dayTotalPL = dayTrades.reduce((sum, item) => sum + item.netProfit, 0);
                                const dayFactor = 1 + (dayTotalPL / firstTradeBalance);
                                monthCumulativeFactor *= dayFactor;
                            }
                        }
                    });

                    const monthTotalPercent = (monthCumulativeFactor - 1) * 100;
                    const monthTotalLabel = document.createElement('div');
                    monthTotalLabel.className = 'month-total';
                    monthTotalLabel.textContent = (monthTotalPercent >= 0 ? '+' : '-') + Math.abs(monthTotalPercent).toFixed(2) + '%';
                    monthTotalLabel.style.color = monthTotalPercent >= 0 ? '#00C853' : '#FF4545';
                    header.appendChild(monthTotalLabel);

                    columnDiv.appendChild(header);

                    // Create calendar container
                    const calendarContainer = document.createElement('div');
                    calendarContainer.className = 'calendar-container';

                    // Add day-of-week header
                    const dayHeader = document.createElement('div');
                    dayHeader.className = 'calendar-day-header';
                    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                    dayNames.forEach(dayName => {
                        const dayHeaderCell = document.createElement('div');
                        dayHeaderCell.className = 'day-header-cell';
                        dayHeaderCell.textContent = dayName;
                        dayHeader.appendChild(dayHeaderCell);
                    });
                    calendarContainer.appendChild(dayHeader);

                    // Create weeks grid
                    const weeksDiv = document.createElement('div');
                    weeksDiv.className = 'calendar-weeks';

                    // Filter out future dates
                    const filteredDays = group.days.filter(date => {
                        const compareDate = new Date(date);
                        compareDate.setHours(0, 0, 0, 0);
                        return compareDate <= endDate;
                    });

                    // Create a proper calendar grid
                    const firstDayOfMonth = new Date(group.year, group.month, 1);
                    const startDayOfWeek = firstDayOfMonth.getDay();

                    // Add empty cells for days before the first day of the month
                    for (let i = 0; i < startDayOfWeek; i++) {
                        const emptyCell = document.createElement('div');
                        emptyCell.className = 'day-cell empty-cell';
                        weeksDiv.appendChild(emptyCell);
                    }

                    // Create a map to track which days we've added
                    const daysMap = new Map();
                    filteredDays.forEach(date => {
                        const dayNum = date.getDate();
                        daysMap.set(dayNum, date);
                    });

                    // Add day cells for each day in the month (1 to last day)
                    const lastDayOfMonth = new Date(group.year, group.month + 1, 0).getDate();
                    for (let day = 1; day <= lastDayOfMonth; day++) {
                        const date = daysMap.get(day);
                        if (date) {
                            const cell = document.createElement('div');
                            cell.className = 'day-cell';
                            cell.dataset.date = formatUTC7Date(date);

                            // Add date number
                            const dayNumber = document.createElement('span');
                            dayNumber.className = 'day-number';
                            dayNumber.textContent = day;
                            cell.appendChild(dayNumber);

                            cell.addEventListener('mouseenter', (e) => showPLTooltip(e, date, cell));
                            cell.addEventListener('mouseleave', hidePLTooltip);

                            weeksDiv.appendChild(cell);
                        } else {
                            // Day exists in month but no data - add empty cell
                            const emptyCell = document.createElement('div');
                            emptyCell.className = 'day-cell empty-cell';
                            const dayNumber = document.createElement('span');
                            dayNumber.className = 'day-number';
                            dayNumber.textContent = day;
                            dayNumber.style.opacity = '0.3';
                            emptyCell.appendChild(dayNumber);
                            weeksDiv.appendChild(emptyCell);
                        }
                    }

                    calendarContainer.appendChild(weeksDiv);
                    columnDiv.appendChild(calendarContainer);
                    grid.appendChild(columnDiv);
                });

                calendar.appendChild(grid);
            }

            function updatePLCalendar() {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let startDate, endDate;

                // Determine date range based on current timeframe
                switch (plCalendarTimeframe) {
                    case 'month':
                        if (plSelectedYear !== null && plSelectedMonth !== null) {
                            startDate = new Date(plSelectedYear, plSelectedMonth, 1);
                            const monthEnd = new Date(plSelectedYear, plSelectedMonth + 1, 0);
                            endDate = monthEnd > today ? today : monthEnd;
                        } else {
                            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                            endDate = today;
                        }
                        break;
                    case 'year':
                        if (plSelectedYear !== null) {
                            startDate = new Date(plSelectedYear, 0, 1);
                            const yearEnd = new Date(plSelectedYear, 11, 31);
                            endDate = yearEnd > today ? today : yearEnd;
                        } else {
                            startDate = new Date(today.getFullYear(), 0, 1);
                            endDate = today;
                        }
                        break;
                    case 'total':
                        if (processedList.length > 0) {
                            const earliestDate = processedList.reduce((min, item) => item.date < min.date ? item : min).date;
                            startDate = new Date(earliestDate);
                        } else {
                            startDate = new Date(today);
                            startDate.setDate(today.getDate() - 30);
                        }
                        endDate = today;
                        break;
                    default:
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = today;
                }

                // Convert date range to UTC+7 strings for comparison
                const startDateStr = formatUTC7Date(startDate);
                const endDateStr = formatUTC7Date(endDate);

                // Filter trades to the current timeframe using string comparison
                const filteredTrades = processedList.filter(item => {
                    const itemDateStr = formatUTC7Date(item.date);
                    return !item.isFunding && itemDateStr >= startDateStr && itemDateStr <= endDateStr;
                });

                // Calculate daily percentage returns from filtered trades (compound)
                const dailyPL = {};

                filteredTrades.forEach(item => {
                    const dateStr = formatUTC7Date(item.date);
                    if (!dailyPL[dateStr]) {
                        dailyPL[dateStr] = 0;
                    }
                    // Calculate return as percentage of balance before this trade
                    const balanceBeforeTrade = item.balance - item.netProfit;
                    if (balanceBeforeTrade > 0) {
                        const returnPercent = (item.netProfit / balanceBeforeTrade) * 100;
                        dailyPL[dateStr] += returnPercent;
                    }
                });

                const cells = document.querySelectorAll('.day-cell');
                const maxAbsPL = Math.max(...Object.values(dailyPL).map(Math.abs), 1);

                cells.forEach(cell => {
                    const date = cell.dataset.date;
                    const pl = dailyPL[date] || 0;

                    cell.className = 'day-cell';
                    cell.dataset.pl = pl;

                    if (pl !== 0) {
                        // 5 levels for gains and losses
                        const absPL = Math.abs(pl);
                        const level = Math.ceil((absPL / maxAbsPL) * 5);
                        const levelClass = Math.min(level, 5);
                        
                        if (pl > 0) {
                            cell.classList.add(`gain-level-${levelClass}`);
                        } else {
                            cell.classList.add(`loss-level-${levelClass}`);
                        }
                    }
                });

                // Update calendar statistics
                updatePLCalendarStats(dailyPL, startDate, endDate);
            }

            function updatePLCalendarStats(dailyPL, startDate, endDate) {
                let totalCumulativeFactor = 1.0;
                let activeDays = 0;
                let bestDay = { date: null, pl: 0 };
                let worstDay = { date: null, pl: 0 };
                const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dateStr = formatUTC7Date(d);
                    const pl = dailyPL[dateStr] || 0;

                    if (pl !== 0) {
                        // Compound the daily returns
                        totalCumulativeFactor *= (1 + (pl / 100));
                        activeDays++;

                        if (pl > bestDay.pl) {
                            bestDay = { date: dateStr, pl };
                        }

                        if (pl < worstDay.pl) {
                            worstDay = { date: dateStr, pl };
                        }
                    }
                }

                const totalPLPercent = (totalCumulativeFactor - 1) * 100;

                // Update stats display
                document.getElementById('pl-cal-total-pl').textContent = (totalPLPercent >= 0 ? '+' : '') + Math.abs(totalPLPercent).toFixed(2) + '%';
                document.getElementById('pl-cal-total-pl').className = `metric-value ${totalPLPercent >= 0 ? 'val-pos' : 'val-neg'}`;

                const avgPL = activeDays > 0 ? totalPLPercent / activeDays : 0;
                document.getElementById('pl-cal-avg-pl').textContent = (avgPL >= 0 ? '+' : '') + Math.abs(avgPL).toFixed(2) + '%';
                document.getElementById('pl-cal-avg-pl').className = `metric-value ${avgPL >= 0 ? 'val-pos' : 'val-neg'}`;

                if (bestDay.date) {
                    const bestDate = new Date(bestDay.date);
                    const dateStr = bestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    document.getElementById('pl-cal-best-day').textContent = `${dateStr}: ${(bestDay.pl >= 0 ? '+' : '') + Math.abs(bestDay.pl).toFixed(2)}%`;
                    document.getElementById('pl-cal-best-day').className = `metric-value ${bestDay.pl >= 0 ? 'val-pos' : 'val-neg'}`;
                } else {
                    document.getElementById('pl-cal-best-day').textContent = '--';
                    document.getElementById('pl-cal-best-day').className = 'metric-value val-neutral';
                }

                if (worstDay.date) {
                    const worstDate = new Date(worstDay.date);
                    const dateStr = worstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    document.getElementById('pl-cal-worst-day').textContent = `${dateStr}: ${(worstDay.pl >= 0 ? '+' : '') + Math.abs(worstDay.pl).toFixed(2)}%`;
                    document.getElementById('pl-cal-worst-day').className = `metric-value ${worstDay.pl >= 0 ? 'val-pos' : 'val-neg'}`;
                } else {
                    document.getElementById('pl-cal-worst-day').textContent = '--';
                    document.getElementById('pl-cal-worst-day').className = 'metric-value val-neutral';
                }

                document.getElementById('pl-cal-active-days').textContent = activeDays;
            }

            function showPLTooltip(e, date, cell) {
                const tooltip = document.getElementById('pl-tooltip');
                const dateStr = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                const pl = cell.dataset.pl ? parseFloat(cell.dataset.pl) : 0;
                tooltip.textContent = `${dateStr} - ${pl >= 0 ? '+' : ''}${pl.toFixed(2)}%`;
                tooltip.style.display = 'block';
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY - 30 + 'px';
            }

            function hidePLTooltip() {
                document.getElementById('pl-tooltip').style.display = 'none';
            }

            // ============================================================
            // DRAWDOWN DISTRIBUTION BY ORDER
            // ============================================================
