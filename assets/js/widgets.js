            function fetchOpenTrades() {
                const url = `https://docs.google.com/spreadsheets/d/e/${SPREADSHEET_ID}/pub?gid=${OPEN_TRADES_GID}&single=true&output=csv&t=${Date.now()}`;
                Papa.parse(url, {
                    download: true, header: true, skipEmptyLines: true,
                    complete: function (results) {
                        if (!results || !Array.isArray(results.data) || results.data.length === 0) {
                            showOpenTradesError('Live feed unreachable or no data returned from Sheet 2.'); return;
                        }
                        if (isHTMLResponse(results.data)) {
                            showOpenTradesError('Live feed returned an HTML error page. Verify Sheet 2 is published and accessible.'); return;
                        }
                        autoDetectOpenTradeColumns(results.meta.fields || [], results.data[0] || {});
                        processOpenTrades(results.data);
                    },
                    error: function (err) { console.error('Live feed connection error', err); showOpenTradesError('Live feed fetch failed. See console for details.'); }
                });
            }

            function showOpenTradesError(message) {
                const tbody = document.getElementById('open-transaction-rows');
                const countEl = document.getElementById('open-trades-count');
                const metricEl = document.getElementById('metric-unrealized-pl');
                if (countEl) countEl.textContent = 'Offline';
                if (metricEl) { metricEl.textContent = '$--'; metricEl.className = 'metric-value val-neutral'; }
                if (tbody) tbody.innerHTML = `<tr><td colspan="13" class="text-center py-8 text-terminalMuted font-sans">${message}</td></tr>`;
            }

            function getZoneInfo(timeZone) {
                const now = new Date();
                const time = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false, timeZone });
                const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName:'short' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
                return { time, offset };
            }
            function getGreetingFromHour(hour, user = 'PONGSAKORN') {
                if (hour >= 5 && hour < 12) return `Good Morning, ${user}!`;
                if (hour >= 12 && hour < 18) return `Good Afternoon, ${user}!`;
                return `Good Evening, ${user}!`;
            }
            function updateWorldClocks() {
                const cities = [
                    { id:'ny-clock', iconId:'ny-icon', offsetId:'ny-offset', zone:'America/New_York' },
                    { id:'london-clock', iconId:'london-icon', offsetId:'london-offset', zone:'Europe/London' },
                    { id:'sydney-clock', iconId:'sydney-icon', offsetId:'sydney-offset', zone:'Australia/Sydney' },
                    { id:'tokyo-clock', iconId:'tokyo-icon', offsetId:'tokyo-offset', zone:'Asia/Tokyo' }
                ];
                cities.forEach(city => {
                    const info = getZoneInfo(city.zone);
                    const clockEl = document.getElementById(city.id);
                    const offsetEl = document.getElementById(city.offsetId);
                    const iconEl = document.getElementById(city.iconId);
                    if (clockEl) clockEl.textContent = info.time;
                    if (offsetEl) offsetEl.textContent = info.offset;
                    if (iconEl) {
                        const hour = parseInt(new Intl.DateTimeFormat('en-US', { hour:'2-digit', hour12:false, timeZone: city.zone }).format(new Date()), 10);
                        const isDay = hour >= 6 && hour < 18;
                        iconEl.className = `fa-solid fa-${isDay ? 'sun' : 'moon'} ${isDay ? 'text-terminalAmber' : 'text-terminalMuted'} text-[9px]`;
                    }
                });
                const bangkokInfo = getZoneInfo('Asia/Bangkok');
                const bangkokText = document.getElementById('bangkok-text');
                const bangkokIcon = document.getElementById('bangkok-icon');
                const bangkokDate = document.getElementById('bangkok-date');
                if (bangkokText) bangkokText.textContent = `Bangkok: ${bangkokInfo.time} (${bangkokInfo.offset})`;
                const bangkokHour = parseInt(new Intl.DateTimeFormat('en-US', { hour:'2-digit', hour12:false, timeZone:'Asia/Bangkok' }).format(new Date()), 10);
                if (bangkokIcon) {
                    const isDay = bangkokHour >= 6 && bangkokHour < 18;
                    bangkokIcon.textContent = isDay ? '☼' : '☾';
                    bangkokIcon.className = isDay ? 'text-terminalAmber text-[14px]' : 'text-terminalMuted text-[14px]';
                }
                if (bangkokDate) {
                    const dateOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' };
                    bangkokDate.textContent = new Intl.DateTimeFormat('en-US', dateOptions).format(new Date());
                }
                const greetingEl = document.getElementById('user-greeting');
                if (greetingEl) greetingEl.textContent = getGreetingFromHour(bangkokHour, currentUser || 'PONGSAKORN');
            }

            // ============================================================
            // UPCOMING US ECONOMIC NEWS (ForexFactory XML feed with CORS proxy)
            // ============================================================
            const NEWS_CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';

            // Function to convert time to 24hr format and add 7 hours, with proper date handling
            function convertTime(timeStr, dateStr) {
                if (!timeStr || timeStr === 'N/A') return { time: 'N/A', date: dateStr };
                
                // Parse the time (assuming format like "12:30pm" or "12:30 PM")
                const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
                if (!timeMatch) return { time: timeStr, date: dateStr };
                
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
                
                // Convert to 24hr format
                if (meridiem === 'pm' && hours !== 12) {
                    hours += 12;
                } else if (meridiem === 'am' && hours === 12) {
                    hours = 0;
                }
                
                // Add 7 hours
                hours += 7;
                
                // Handle date rollover
                let dateOffset = 0;
                if (hours >= 24) {
                    hours = hours % 24;
                    dateOffset = 1;
                }
                
                // Parse the original date and add offset if needed
                let newDate = dateStr;
                if (dateOffset > 0 && dateStr) {
                    try {
                        // Parse date format MM-DD-YYYY
                        const parts = dateStr.split('-');
                        if (parts.length === 3) {
                            const month = parseInt(parts[0], 10) - 1;
                            const day = parseInt(parts[1], 10);
                            const year = parseInt(parts[2], 10);
                            const dateObj = new Date(year, month, day);
                            dateObj.setDate(dateObj.getDate() + dateOffset);
                            
                            // Format back to MM-DD-YYYY
                            const newMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const newDay = String(dateObj.getDate()).padStart(2, '0');
                            const newYear = dateObj.getFullYear();
                            newDate = `${newMonth}-${newDay}-${newYear}`;
                        }
                    } catch (e) {
                        console.log('Date parsing error:', e);
                    }
                }
                
                // Format in 24hr format
                const formattedHours = hours.toString().padStart(2, '0');
                const formattedMinutes = minutes.toString().padStart(2, '0');
                
                return {
                    time: `${formattedHours}:${formattedMinutes}`,
                    date: newDate
                };
            }

            async function fetchNewsCalendar() {
                const list = document.getElementById('news-calendar-list');
                const updatedEl = document.getElementById('news-updated-at');
                
                if (list) list.innerHTML = '<div class="text-center py-8 text-terminalMuted text-xs">Loading economic calendar…</div>';
                if (updatedEl) updatedEl.textContent = '';
                
                try {
                    const targetUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
                    
                    // Try with MANY different proxy options
                    const corsProxies = [
                        'https://corsproxy.io/?',
                        'https://api.allorigins.win/raw?url=',
                        'https://api.allorigins.win/get?url=',
                        'https://cors-anywhere.herokuapp.com/',
                        'https://thingproxy.freeboard.io/fetch/',
                        'https://crossorigin.me/',
                        'https://api.codetabs.com/v1/proxy?quest='
                    ];
                    
                    let xmlText = null;
                    let lastError = null;
                    
                    for (const proxy of corsProxies) {
                        try {
                            console.log(`Trying proxy: ${proxy}`);
                            const response = await fetch(proxy + encodeURIComponent(targetUrl), {
                                headers: {
                                    'Content-Type': 'application/xml',
                                }
                            });
                            if (response.ok) {
                                const text = await response.text();
                                // Handle JSON response from some proxies
                                if (proxy.includes('get')) {
                                    const json = JSON.parse(text);
                                    xmlText = json.contents;
                                } else {
                                    xmlText = text;
                                }
                                console.log('Success with proxy:', proxy);
                                break;
                            }
                        } catch (error) {
                            lastError = error;
                            console.log(`Proxy ${proxy} failed:`, error.message);
                        }
                    }
                    
                    if (!xmlText) {
                        throw new Error(lastError?.message || 'All proxies failed');
                    }
                    
                    // Parse the XML
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    
                    // Check for parsing errors
                    const parseError = xmlDoc.querySelector('parsererror');
                    if (parseError) {
                        throw new Error('XML parsing error');
                    }
                    
                    // Get events using getElementsByTagName (more reliable than querySelectorAll)
                    const events = xmlDoc.getElementsByTagName('event');
                    
                    if (events.length === 0) {
                        if (list) list.innerHTML = '<div class="text-center py-8 text-terminalMuted text-xs">No events found in the calendar.</div>';
                        return;
                    }
                    
                    let highImpactUSDCount = 0;
                    const eventData = [];
                    
                    for (let i = 0; i < events.length; i++) {
                        const event = events[i];
                        
                        // Extract event data using getElementsByTagName (same as test.html)
                        const title = event.getElementsByTagName('title')[0]?.textContent || 'N/A';
                        const country = event.getElementsByTagName('country')[0]?.textContent || 'N/A';
                        const date = event.getElementsByTagName('date')[0]?.textContent || 'N/A';
                        const time = event.getElementsByTagName('time')[0]?.textContent || 'N/A';
                        const impact = event.getElementsByTagName('impact')[0]?.textContent || 'N/A';
                        const forecast = event.getElementsByTagName('forecast')[0]?.textContent || 'N/A';
                        const previous = event.getElementsByTagName('previous')[0]?.textContent || 'N/A';
                        
                        // Filter for high impact USD events (exact same logic as test.html)
                        const isUSD = country.toUpperCase() === 'USD';
                        const isHighImpact = impact.toUpperCase() === 'HIGH' || 
                                           impact.toUpperCase() === '3' || // sometimes impact is numeric
                                           impact.includes('High');
                        
                        if (isUSD && isHighImpact) {
                            highImpactUSDCount++;
                            const convertedTime = convertTime(time, date);
                            eventData.push({
                                title,
                                date: convertedTime.date,
                                time: convertedTime.time,
                                country,
                                impact,
                                forecast,
                                previous
                            });
                        }
                    }
                    
                    // Render events in the dashboard style
                    if (highImpactUSDCount === 0) {
                        if (list) list.innerHTML = '<div class="text-center py-8 text-terminalMuted text-xs">No high impact USD events found in the calendar.</div>';
                    } else {
                        if (list) {
                            list.innerHTML = '';
                            eventData.forEach(e => {
                                const style = newsImpactStyle(e.impact);
                                const row = document.createElement('div');
                                row.className = `flex items-center gap-3 rounded-lg border px-3 py-2 transition-all hover:brightness-125 ${style.border} ${style.bg}`;
                                row.innerHTML = `
                                    <div class="flex flex-col items-center justify-center min-w-[68px] text-center">
                                        <span class="text-[9px] uppercase tracking-widest text-terminalMuted">${e.date}</span>
                                        <span class="text-xs font-black ${style.text}">${e.time}</span>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-bold text-terminalText truncate">${e.title}</p>
                                        <p class="text-[9px] uppercase tracking-widest ${style.text}">${e.impact} Impact</p>
                                    </div>
                                    <div class="flex gap-4 text-right shrink-0">
                                        <div><p class="text-[8px] text-terminalMuted uppercase tracking-widest">Forecast</p><p class="text-xs font-mono text-terminalText">${e.forecast || '—'}</p></div>
                                        <div><p class="text-[8px] text-terminalMuted uppercase tracking-widest">Previous</p><p class="text-xs font-mono text-terminalMuted">${e.previous || '—'}</p></div>
                                    </div>
                                `;
                                list.appendChild(row);
                            });
                        }
                    }
                    
                    // Set updated timestamp
                    if (updatedEl) {
                        const now = new Date();
                        updatedEl.textContent = `Updated: ${now.toLocaleTimeString()}`;
                    }
                    
                } catch (error) {
                    console.error('Error fetching news calendar:', error);
                    // Show error instead of fallback
                    if (list) {
                        list.innerHTML = `
                            <div class="text-center py-8 text-terminalMuted text-xs">
                                <p class="font-bold">Unable to load live economic calendar</p>
                                <p class="text-[10px] mt-2 opacity-70">Error: ${error.message}</p>
                                <p class="text-[10px] mt-1 opacity-50">External service blocking requests via CORS policy</p>
                                <button onclick="fetchNewsCalendar()" class="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-bold transition-all">Retry Now</button>
                            </div>
                        `;
                    }
                    if (updatedEl) updatedEl.textContent = '';
                }
            }

            function newsImpactStyle(impact) {
                switch ((impact || '').toLowerCase()) {
                    case 'high':    return { border: 'border-terminalRed/30',   bg: 'bg-terminalRed/5',   text: 'text-terminalRed' };
                    case 'medium':  return { border: 'border-terminalAmber/30',  bg: 'bg-terminalAmber/5',  text: 'text-terminalAmber' };
                    case 'holiday': return { border: 'border-terminalCyan/30',   bg: 'bg-terminalCyan/5',   text: 'text-terminalCyan' };
                    default:        return { border: 'border-terminalBorder',      bg: 'bg-terminalDark/20',  text: 'text-terminalMuted' };
                }
            }
