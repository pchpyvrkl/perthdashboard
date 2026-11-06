# ROWRIC Live Portfolio Auditor

A single-page trading journal / portfolio analytics dashboard. Refactored from a
single 6,600-line HTML file into a modular, maintainable web application.

## Features

- PIN-lock welcome screen with user selection
- Live market ticker tape and macro rates (Yahoo Finance: ^TNX, ^GSPC, S&P 500)
- World clocks and economic calendar (ForexFactory XML feed)
- CSV portfolio import from a published Google Sheet (PapaParse)
- Open-positions table from a second published Google Sheet
- Portfolio analytics: TWR/additive gains, drawdown, win rate, profit factor,
  monthly returns heatmap, P/L calendar, drawdown distribution/heatmap
- Institution metrics, duration/hourly/daily performance, attribution, lots & rebate
- Monte Carlo simulation and risk-of-ruin analysis
- PDF export (html2canvas + jsPDF) and monthly report generation
- Financial privacy toggle (masks all values)

## Folder structure

```
├── index.html                  # Markup shell + script/link tags only
├── server.js                   # Zero-dependency static dev server
├── package.json
├── Code.gs                     # Google Apps Script backend (unchanged)
├── legacy/
│   └── index.html              # Original single-file implementation (reference)
└── assets/
    ├── css/
    │   └── styles.css          # All custom CSS (was inline <style>)
    └── js/
        ├── config.js           # API endpoints, sheet IDs, constants
        ├── state.js            # Global application state + privacy toggle
        ├── market-data.js      # Yahoo Finance fetchers, ticker tape, macro rates
        ├── auth.js             # PIN lock screen logic
        ├── bootstrap.js        # initializeOverview + window.onload wiring
        ├── widgets.js          # Open-trades fetcher, world clocks, news calendar
        ├── open-trades.js      # Open positions parsing/rendering
        ├── data.js             # Portfolio CSV fetch + column auto-mapping
        ├── navigation.js       # Date filter, section scrolling, filtered metrics
        ├── portfolio.js        # Transaction processing + dashboard metrics
        ├── analytics.js        # Monthly returns, drawdown matrix/heatmap
        ├── pl-calendar.js      # P/L calendar widget
        ├── drawdown.js         # Drawdown distribution chart
        ├── history-table.js    # Transaction history table
        ├── charts.js           # Main equity chart + benchmark/RFR metrics
        ├── risk-analytics.js   # Institution metrics, attribution, risk of ruin
        ├── simulation.js       # Monte Carlo simulation
        ├── monthly-report.js   # Monthly report generator
        ├── pdf-export.js       # PDF export (transactions + dashboard)
        └── config/
            └── tailwind.config.js  # Tailwind theme (Bloomberg-terminal palette)
```

Scripts are loaded as **classic (non-module) scripts in the order listed in
`index.html`**. They intentionally share the global scope — this preserves the
original application's architecture and guarantees identical execution order.
Each file maps to a contiguous section of the original script, so the code is
functionally identical to `legacy/index.html`.

## Technologies

- Vanilla HTML/CSS/JavaScript (no framework, no build step)
- Tailwind CSS (Play CDN) + Chart.js + PapaParse + html2canvas + jsPDF (CDN)
- Google Sheets published-CSV endpoints (data source)
- Yahoo Finance unofficial chart API (market/macro data)
- ForexFactory weekly calendar XML (via CORS proxies)
- `Code.gs` — Google Apps Script (serves as the backend; unchanged)

## Installation & development

Requires Node.js (any modern version). No `npm install` needed — there are no
runtime dependencies.

```bash
npm start          # serves on http://localhost:8080
npm run dev        # serves on http://localhost:3000
node server.js --port 4000   # custom port
PORT=5000 node server.js     # or via env var
```

Python alternative: `python3 -m http.server 8080`

## Configuration

- `assets/js/config.js` — `SPREADSHEET_ID`, `OPEN_TRADES_GID`, `REBATE_PER_LOT`
- `assets/js/market-data.js` — `MARKET_TICKERS`, `MACRO_FETCHERS` (CORS fallbacks)
- `assets/js/widgets.js` — `NEWS_CALENDAR_URL`, CORS proxy list
- `assets/js/auth.js` — `PIN_USERS`
- `server.js` — port via `--port` flag or `PORT` env var

> **Security note:** this is a fully client-side app. The Google Sheet IDs and
> PINs are visible in the shipped JavaScript by design (same as the original).
> Do not put private API keys here — any secret must live in `Code.gs`
> (Apps Script) or a backend service instead.

## Deployment

Static hosting only — upload the folder contents (or run any static file server).
`Code.gs` is deployed separately via Google Apps Script if used.

## Known pre-existing issues (preserved, not introduced)

- The `<link rel="icon">` / `apple-touch-icon` `href` attributes contain a
  malformed value (`Symbol Logo.png,<base64...>`). Left as-is; fix the `href`
  to a real icon path or `data:` URI if a favicon is needed.
- Global mutable state is shared across script files (intentional, see above).
