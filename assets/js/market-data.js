            const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
            const MACRO_FETCHERS = [
                // 1-2) Direct — Yahoo chart API sends Access-Control-Allow-Origin: *
                //      (two hostnames in case one is blocked by DNS/adblock/CSP)
                (url) => fetch(url.replace('query1.', 'query2.'), { headers: { 'Accept': 'application/json' } }),
                (url) => fetch(url, { headers: { 'Accept': 'application/json' } }),
                // 3) CORS proxies as fallback
                ...[
                    'https://corsproxy.io/?url=',
                    'https://api.allorigins.win/raw?url=',
                    'https://api.codetabs.com/v1/proxy?quest=',
                    'https://api.allorigins.win/get?url='
                ].map((proxy) => (url) => fetch(proxy + encodeURIComponent(url), { headers: { 'Accept': 'application/json' } }))
            ];

            async function fetchYahooJson(symbol, range, interval) {
                const target = `${YAHOO_CHART_BASE}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
                let lastError = null;
                for (const doFetch of MACRO_FETCHERS) {
                    try {
                        const response = await doFetch(target);
                        if (!response.ok) { lastError = new Error(`HTTP ${response.status}`); continue; }
                        let text = await response.text();
                        // allorigins /get wraps payload in JSON { contents: ... }
                        if (text.trim().startsWith('{') && !text.includes('"chart"')) {
                            try { const wrapped = JSON.parse(text); if (wrapped && typeof wrapped.contents === 'string') text = wrapped.contents; } catch (_) {}
                        }
                        const json = JSON.parse(text);
                        const result = json?.chart?.result?.[0];
                        if (result && result.meta) return result;
                        lastError = new Error('Empty chart result');
                    } catch (e) { lastError = e; }
                }
                throw lastError || new Error('All fetchers failed');
            }

            function latestClose(result) {
                const closes = result?.indicators?.quote?.[0]?.close || [];
                for (let i = closes.length - 1; i >= 0; i--) {
                    if (typeof closes[i] === 'number' && isFinite(closes[i])) return closes[i];
                }
                return null;
            }

            function firstValidClose(result) {
                const closes = result?.indicators?.quote?.[0]?.close || [];
                for (const c of closes) {
                    if (typeof c === 'number' && isFinite(c)) return c;
                }
                return null;
            }

            // ============================================================
            // ============================================================
            // LIVE MARKET TICKER (Yahoo Finance — overview top bar)
            // ============================================================
            const MARKET_TICKERS = [
                { label: 'XAUUSD', sym: 'GC=F',  yield: false },
                { label: 'WTI',    sym: 'CL=F',  yield: false },
                { label: 'US10Y',  sym: '^TNX',  yield: true },
                { label: 'US03M',  sym: '^IRX',  yield: true },
                { label: 'SPX',    sym: '^GSPC', yield: false },
                { label: 'NDX',    sym: '^NDX',  yield: false },
                { label: 'DXY',    sym: 'DX-Y.NYB', yield: false }
            ];

            function makeTickerSet() {
                const set = document.createElement('div');
                set.className = 'flex items-center gap-5 pr-5 shrink-0';
                MARKET_TICKERS.forEach(t => {
                    const span = document.createElement('span');
                    span.className = 'shrink-0';
                    span.dataset.ticker = t.label;
                    span.innerHTML = `<span class="text-terminalMuted">${t.label}</span> <b class="tk-price text-terminalText">--</b> <b class="tk-chg val-neutral">--</b>`;
                    set.appendChild(span);
                });
                return set;
            }

            function buildTickerBar() {
                const track = document.getElementById('ticker-track');
                if (!track || track.dataset.built) return;
                track.appendChild(makeTickerSet());
                track.appendChild(makeTickerSet());
                track.dataset.built = '1';

                const bar = document.getElementById('ticker-bar');
                if (bar && !bar.dataset.hoverBound) {
                    bar.addEventListener('mouseenter', () => { tickerPaused = true; });
                    bar.addEventListener('mouseleave', () => { tickerPaused = false; });
                    bar.dataset.hoverBound = '1';
                }
                startTickerScroll();
            }

            // Duplicate sets until the track covers viewport + one full set,
            // so the wrap point never shows blank space
            function ensureTickerSets() {
                const track = document.getElementById('ticker-track');
                if (!track || !track.children.length) return;
                const setWidth = track.children[0].offsetWidth;
                const viewport = track.parentElement ? track.parentElement.clientWidth : 0;
                if (!setWidth || !viewport) return;
                let guard = 0;
                while (track.scrollWidth < viewport + setWidth && guard++ < 20) {
                    track.appendChild(makeTickerSet());
                }
            }

            let tickerScrollRAF = null;
            let tickerScrollX = 0;
            let tickerPaused = false;

            function startTickerScroll() {
                if (tickerScrollRAF) return;
                const SPEED = 45; // px per second
                let last = performance.now();
                const tick = (now) => {
                    const dt = Math.min(0.1, (now - last) / 1000);
                    last = now;
                    const track = document.getElementById('ticker-track');
                    if (track) {
                        ensureTickerSets();
                        const setWidth = track.children[0] ? track.children[0].offsetWidth : 0;
                        if (setWidth > 0 && !tickerPaused) {
                            tickerScrollX -= SPEED * dt;
                            if (tickerScrollX <= -setWidth) tickerScrollX += setWidth;
                            track.style.transform = `translateX(${tickerScrollX}px)`;
                        }
                    }
                    tickerScrollRAF = requestAnimationFrame(tick);
                };
                tickerScrollRAF = requestAnimationFrame(tick);
            }

            function loadTickerCache() {
                try { return JSON.parse(localStorage.getItem('rowric_ticker_quotes') || '{}'); } catch (e) { return {}; }
            }
            function saveTickerCache(map) {
                try { localStorage.setItem('rowric_ticker_quotes', JSON.stringify(map)); } catch (e) {}
            }

            function applyTickerValues(els, priceText, chgText, chgClass) {
                els.forEach(el => {
                    el.querySelector('.tk-price').textContent = priceText;
                    const chgEl = el.querySelector('.tk-chg');
                    chgEl.textContent = chgText;
                    chgEl.className = chgClass;
                });
            }

            async function fetchTickerQuotes() {
                buildTickerBar();
                const bar = document.getElementById('ticker-bar');
                if (!bar) return;

                // Paint cached values instantly so the bar is never '--' after first success
                const cache = loadTickerCache();
                MARKET_TICKERS.forEach(t => {
                    const c = cache[t.label];
                    if (c) {
                        const els = bar.querySelectorAll(`[data-ticker="${t.label}"]`);
                        if (els.length) applyTickerValues(els, c.p, c.c, c.cls);
                    }
                });

                const results = await Promise.allSettled(
                    MARKET_TICKERS.map(t => fetchYahooJson(t.sym, '1d', '1d'))
                );
                results.forEach((res, i) => {
                    const t = MARKET_TICKERS[i];
                    const els = bar.querySelectorAll(`[data-ticker="${t.label}"]`);
                    if (!els.length) return;

                    let priceText = '--', chgText = '--', chgClass = 'tk-chg val-neutral';
                    if (res.status === 'fulfilled') {
                        const meta = res.value?.meta || {};
                        let price = meta.regularMarketPrice;
                        let prev = meta.chartPreviousClose;
                        if (typeof price === 'number' && isFinite(price)) {
                            // Yahoo quotes ^TNX/^IRX as yield x10
                            if (t.yield && price > 15) price = price / 10;
                            if (typeof prev === 'number' && isFinite(prev) && t.yield && prev > 15) prev = prev / 10;

                            priceText = t.yield ? price.toFixed(2) + '%' : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                            if (typeof prev === 'number' && isFinite(prev) && prev !== 0) {
                                const diff = price - prev;
                                const pct = (diff / prev) * 100;
                                if (t.yield) {
                                    // yields: show absolute change in percentage points
                                    chgText = (diff >= 0 ? '+' : '') + diff.toFixed(2);
                                } else {
                                    chgText = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                                }
                                chgClass = `tk-chg ${diff >= 0 ? 'val-pos' : 'val-neg'}`;
                            }
                        }
                    }

                    cache[t.label] = { p: priceText, c: chgText, cls: chgClass };
                    applyTickerValues(els, priceText, chgText, chgClass);
                });
                saveTickerCache(cache);
            }

            // S&P 500 DAILY HISTORY (equity chart overlay — DLY/MTH/YR only)
            // ============================================================
            let spxHistory = null;        // { range, byDay:{}, byMonth:{}, byYear:{} }
            let spxHistoryLoading = false;
            let lastSPXFetch = 0;         // throttle full-history refetches (heavy payload)

            async function ensureSPXHistory() {
                if (spxHistory || spxHistoryLoading || processedList.length === 0) return;
                const earliest = processedList[0].date;
                const spanDays = Math.max(1, (Date.now() - earliest.getTime()) / 86400000);
                const range = spanDays <= 200 ? '6mo' : spanDays <= 400 ? '1y' : spanDays <= 800 ? '2y' : spanDays <= 1600 ? '5y' : spanDays <= 3700 ? '10y' : 'max';
                spxHistoryLoading = true;
                lastSPXFetch = Date.now();
                try {
                    const res = await fetchYahooJson('^GSPC', range, '1d');
                    const closes = res?.indicators?.quote?.[0]?.close || [];
                    const ts = res?.timestamp || [];
                    const byDay = {}, byMonth = {}, byYear = {};
                    for (let i = 0; i < ts.length; i++) {
                        const c = closes[i];
                        if (typeof c !== 'number' || !isFinite(c)) continue;
                        const iso = new Date(ts[i] * 1000).toISOString().split('T')[0];
                        byDay[iso] = c;
                        byMonth[iso.slice(0, 7)] = c;  // timestamps ascend — last trading day of period wins
                        byYear[iso.slice(0, 4)] = c;
                    }
                    spxHistory = { range, byDay, byMonth, byYear, dates: Object.keys(byDay).sort() };
                    updateSPXBenchmarkMetric();
                } catch (e) {
                    console.warn('S&P500 history fetch failed:', e);
                    spxHistory = { range, byDay: {}, byMonth: {}, byYear: {}, dates: [] }; // avoid retry spam
                } finally {
                    spxHistoryLoading = false;
                }
            }

            // S&P 500 return shown as "+since portfolio start% (+YTD%)"
            function updateSPXBenchmarkMetric() {
                const el = document.getElementById('metric-spx-return');
                if (!el || !spxHistory || !spxHistory.dates || spxHistory.dates.length === 0) return;
                const dates = spxHistory.dates;
                const lastClose = spxHistory.byDay[dates[dates.length - 1]];
                if (!lastClose) return;
                const fmt = (r) => (r >= 0 ? '+' : '') + r.toFixed(2) + '%';

                // YTD: last trading day of prior year → latest close
                const yearStart = `${new Date().getFullYear()}-01-01`;
                let firstIdx = dates.findIndex(d => d >= yearStart);
                if (firstIdx < 0) firstIdx = dates.length - 1;
                const ytdBase = spxHistory.byDay[dates[Math.max(0, firstIdx - 1)]];
                const ytd = ytdBase ? ((lastClose - ytdBase) / ytdBase) * 100 : null;

                // Since portfolio start: last trading day on/before first trade → latest close
                let startRet = null;
                if (processedList.length > 0) {
                    const earliestIso = processedList[0].date.toISOString().split('T')[0];
                    let baseIdx = -1;
                    for (let i = dates.length - 1; i >= 0; i--) {
                        if (dates[i] <= earliestIso) { baseIdx = i; break; }
                    }
                    const startBase = baseIdx >= 0 ? spxHistory.byDay[dates[baseIdx]] : null;
                    if (startBase) startRet = ((lastClose - startBase) / startBase) * 100;
                }

                if (startRet === null && ytd === null) return;
                const main = startRet !== null ? startRet : ytd;
                el.textContent = startRet !== null
                    ? `${fmt(startRet)}${ytd !== null ? ` (${fmt(ytd)})` : ''}`
                    : fmt(ytd);
                el.className = `metric-value ${main >= 0 ? 'val-pos' : 'val-neg'}`;
            }

            function saveMacroCache() {
                try {
                    localStorage.setItem('rowric_macro', JSON.stringify({
                        rfr: ANNUAL_RISK_FREE_RATE,
                        bmk: ANNUAL_BENCHMARK_RETURN
                    }));
                } catch (e) {}
            }

            function restoreMacroCache() {
                try {
                    const m = JSON.parse(localStorage.getItem('rowric_macro') || 'null');
                    if (!m) return;
                    if (m.rfr) {
                        ANNUAL_RISK_FREE_RATE = m.rfr;
                        const el = document.getElementById('rfr-value');
                        if (el) el.textContent = m.rfr.toFixed(2);
                    }
                    if (m.bmk !== undefined) {
                        ANNUAL_BENCHMARK_RETURN = m.bmk;
                        const el = document.getElementById('bmk-value');
                        if (el) el.textContent = m.bmk.toFixed(2);
                    }
                } catch (e) {}
            }

            async function fetchMarketMacroRates() {
                // Fetch both tickers in parallel so one failure doesn't block the other
                const [tnxRes, spxRes] = await Promise.allSettled([
                    fetchYahooJson('^TNX', '5d', '1d'),
                    fetchYahooJson('^GSPC', '1y', '1d')
                ]);

                // US10Y yield — ^TNX is quoted by Yahoo as yield x10 (e.g. 44.5 = 4.45%)
                if (tnxRes.status === 'fulfilled') {
                    let rfr = latestClose(tnxRes.value) ?? tnxRes.value?.meta?.regularMarketPrice ?? null;
                    if (rfr !== null && rfr > 15) rfr = rfr / 10;
                    if (rfr !== null && isFinite(rfr) && rfr >= 0 && rfr <= 20) {
                        ANNUAL_RISK_FREE_RATE = rfr;
                        const el = document.getElementById('rfr-value');
                        if (el) el.textContent = rfr.toFixed(2);
                        saveMacroCache();
                    }
                } else {
                    console.warn('US10Y (^TNX) fetch failed:', tnxRes.reason);
                }

                // S&P 500 trailing 1-year return — ^GSPC
                if (spxRes.status === 'fulfilled') {
                    const spxFirst = firstValidClose(spxRes.value);
                    const spxLast = latestClose(spxRes.value) ?? spxRes.value?.meta?.regularMarketPrice ?? null;
                    if (spxFirst && spxLast && spxFirst > 0) {
                        const bmk = ((spxLast - spxFirst) / spxFirst) * 100;
                        if (isFinite(bmk)) {
                            ANNUAL_BENCHMARK_RETURN = bmk;
                            const el = document.getElementById('bmk-value');
                            if (el) el.textContent = bmk.toFixed(2);
                            saveMacroCache();
                        }
                    }
                } else {
                    console.warn('S&P500 (^GSPC) fetch failed:', spxRes.reason);
                }

                // Recompute dependent metrics with the fresh values
                if (cachedBaseMetrics) {
                    updateRFRDependentMetrics(cachedBaseMetrics);
                    updateBenchmarkDependentMetrics(cachedBaseMetrics);
                }
                console.log(`Macro rates — US10Y: ${ANNUAL_RISK_FREE_RATE ? ANNUAL_RISK_FREE_RATE.toFixed(2) + '%' : '--'}, S&P500 1Y: ${ANNUAL_BENCHMARK_RETURN ? ANNUAL_BENCHMARK_RETURN.toFixed(2) + '%' : '--'}`);
            }

            // ============================================================
            // PIN LOCK
            // ============================================================
