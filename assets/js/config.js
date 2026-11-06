            // ============================================================
            // GLOBAL CONFIGURATION
            // ============================================================
            const SPREADSHEET_ID = "2PACX-1vQQj8EzNYOAPc70wbmz--2hiq1tfeH76njnadmTVs-3UZIxH7JDcJuXzhDQeRw4Ee3hEtFbyYJP2yNg";
            const OPEN_TRADES_GID = "1116835953";

            // Macro rates — populated exclusively from live Yahoo Finance data (^TNX / ^GSPC)
            let ANNUAL_RISK_FREE_RATE = 0;   // %  (US10Y yield, live)
            let ANNUAL_BENCHMARK_RETURN = 0;  // %  (S&P500 trailing 1Y return, live)
            const REBATE_PER_LOT = 7; // $ per lot

            // ============================================================
            // GLOBAL STATE
            // ============================================================
