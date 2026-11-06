// Google Apps Script for MT5 Data Hook
// This script receives trading data from MT5 EA and appends it to Google Sheets

// Replace with your Google Sheet ID
const SHEET_ID = '13njb8MTv1zgHP-HZ881MkXyCPOTrNGqyT7zP6-YHNH0';

function getFieldValue(obj, keys, defaultValue) {
  if (!obj || !keys) return defaultValue;
  for (let key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return defaultValue;
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizePayload(rawData) {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData;
  const isUnrealized = toBoolean(rawData.isUnrealized) || toBoolean(rawData.unrealized);
  let data = rawData.data || rawData.trades || rawData.positions || rawData.orders || rawData; 
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      data = [data];
    } else {
      data = [];
    }
  }
  return {data, isUnrealized};
}

function doPost(e) {
  try {
    // Check if event object exists
    if (!e || !e.postData) {
      const errorResult = {
        'status': 'error',
        'message': 'No data received'
      };
      return ContentService.createTextOutput(JSON.stringify(errorResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Log the incoming data for debugging
    Logger.log('Received data: ' + e.postData.contents);
    
    // Parse the incoming data
    const rawData = JSON.parse(e.postData.contents);
    let data = [];
    let isUnrealized = false;

    const normalized = normalizePayload(rawData);
    if (Array.isArray(normalized)) {
      data = normalized;
    } else {
      data = normalized.data || [];
      isUnrealized = normalized.isUnrealized || false;
    }
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const historicalHeaders = ['#', 'In Time', 'Out Time', 'Symbol', 'Type', 'Volume', 'In Price', 'Out Price', 'Profit', 'Commission', 'Swap', 'Magic', 'Position ID', 'Comment'];
    const unrealizedHeaders = ['#', 'In Time', 'Status', 'Symbol', 'Type', 'Volume', 'In Price', 'Current Price', 'Take Profit Price', 'Stop Loss Price', 'Profit', 'Commission', 'Swap', 'Magic', 'Position ID', 'Comment'];

    // Handle Unrealized orders (Sheet 2)
    if (isUnrealized) {
      let sheet = ss.getSheetByName("Sheet 2") || ss.insertSheet("Sheet 2");
      const lastRow = sheet.getLastRow();
      const tradeCount = data.length;

      // FULL SYNC ALWAYS: rewrite the whole open-position block to avoid stale rows,
      // then clear any leftover rows below the current dataset.
      const rows = data.map((deal, idx) => {
        const takeProfit = getFieldValue(deal, ['takeProfit', 'tp', 'TakeProfit', 'take_profit', 'takeprofit'], '');
        const stopLoss = getFieldValue(deal, ['stopLoss', 'sl', 'StopLoss', 'stop_loss', 'stoploss'], '');
        const currentPrice = getFieldValue(deal, ['outPrice', 'currentPrice', 'priceCurrent', 'current_price'], '');
        const positionId = getFieldValue(deal, ['positionId', 'position_id', 'PositionID', 'positionId'], '');
        const comment = getFieldValue(deal, ['comment', 'Comment', 'label', 'note'], '');

        return [
          idx + 1,
          String(getFieldValue(deal, ['inTime', 'openTime', 'InTime', 'time'], '')),
          String(getFieldValue(deal, ['status', 'Status'], 'Unrealized')),
          getFieldValue(deal, ['symbol', 'Symbol'], ''),
          getFieldValue(deal, ['type', 'Type'], ''),
          getFieldValue(deal, ['volume', 'Volume'], ''),
          getFieldValue(deal, ['inPrice', 'openPrice', 'InPrice'], ''),
          currentPrice,
          takeProfit,
          stopLoss,
          getFieldValue(deal, ['profit', 'Profit', 'pnl'], ''),
          getFieldValue(deal, ['commission', 'Commission'], ''),
          getFieldValue(deal, ['swap', 'Swap'], ''),
          getFieldValue(deal, ['magic', 'Magic'], ''),
          positionId,
          comment
        ];
      });

      sheet.getRange(1, 1, 1, unrealizedHeaders.length).setValues([unrealizedHeaders]);

      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      if (lastRow > rows.length + 1) {
        sheet.getRange(rows.length + 2, 1, lastRow - (rows.length + 1), unrealizedHeaders.length).clearContent();
      }

      if (rows.length === 0 && lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, unrealizedHeaders.length).clearContent();
      }

      return ContentService.createTextOutput(JSON.stringify({'status': 'success', 'type': 'unrealized_updated'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle Historical data (Sheet 1)
    const sheet = ss.getSheetByName("Sheet 1") || ss.insertSheet("Sheet 1");
    const headers = historicalHeaders;
    
    const lastRow = sheet.getLastRow();
    let existingHistoryKeys = new Set();
    if (lastRow > 1) {
      const existingRows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      existingRows.forEach(row => {
        const existingPositionId = String(row[12] || '').trim();
        const existingOutTime = String(row[2] || '').trim();
        const existingInTime = String(row[1] || '').trim();
        const existingSymbol = String(row[3] || '').trim();
        const existingKey = existingPositionId
          ? `${existingPositionId}|${existingOutTime}`
          : `${existingInTime}|${existingOutTime}|${existingSymbol}`;
        existingHistoryKeys.add(existingKey);
      });
    }

    let lastUsedRowInRange = lastRow;

    const makeHistoryKey = (deal) => {
      const id = String(deal.positionId || '').trim();
      const outTime = String(deal.outTime || '').trim();
      const inTime = String(deal.inTime || '').trim();
      const symbol = String(deal.symbol || '').trim();
      return id ? `${id}|${outTime}` : `${inTime}|${outTime}|${symbol}`;
    };

    // Filter to only include historical (closed) trades and balance operations.
    // In MT5, active/open positions have an outTime of "0".
    let newData = data.filter(deal => {
      if (deal.type === "BALANCE") return true;
      const outTimeStr = String(deal.outTime || "0");
      return outTimeStr !== "0" && !outTimeStr.startsWith("1970");
    });

    const seenHistoryKeys = new Set();
    newData = newData.filter(deal => {
      const key = makeHistoryKey(deal);
      if (seenHistoryKeys.has(key) || existingHistoryKeys.has(key)) {
        return false;
      }
      seenHistoryKeys.add(key);
      return true;
    });

    // Strictly check headers in columns A through N (the first 14 columns).
    const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(h => h.toString().trim());
    
    // Verify if the headers match the requested 14-column layout.
    const headersMatch = headers.every((h, i) => currentHeaders[i] === h);

    if (lastUsedRowInRange === 0 || !headersMatch) {
      // If headers are missing or incorrect, clear ONLY columns A through N.
      // This preserves any custom data or formulas you have in columns O, P, etc.
      sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).clearContent();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      lastUsedRowInRange = 1;
    }

    if (newData && newData.length > 0) {
      const rows = newData.map((deal, idx) => {
        const positionId = getFieldValue(deal, ['positionId', 'position_id', 'PositionID', 'positionId'], '');
        const rowType = getFieldValue(deal, ['type', 'Type'], '');
        const inTime = getFieldValue(deal, ['inTime', 'openTime', 'InTime', 'time'], '');
        const outTime = getFieldValue(deal, ['outTime', 'closeTime', 'OutTime', 'close_time'], '');
        const inPrice = getFieldValue(deal, ['inPrice', 'openPrice', 'InPrice'], '');
        const outPrice = getFieldValue(deal, ['outPrice', 'closePrice', 'OutPrice'], '');
        const profit = getFieldValue(deal, ['profit', 'Profit', 'pnl'], '');
        const commission = getFieldValue(deal, ['commission', 'Commission'], '');
        const swap = getFieldValue(deal, ['swap', 'Swap'], '');
        const magic = getFieldValue(deal, ['magic', 'Magic'], '');
        const comment = getFieldValue(deal, ['comment', 'Comment', 'label', 'note'], '');

        return [
          lastUsedRowInRange + idx,
          String(inTime),
          String(rowType === 'BALANCE' ? inTime : outTime),
          getFieldValue(deal, ['symbol', 'Symbol'], ''),
          rowType === 'BALANCE' ? (Number(profit) < 0 ? 'Withdrawals' : 'Deposit') : rowType,
          getFieldValue(deal, ['volume', 'Volume'], ''),
          inPrice,
          outPrice,
          profit,
          commission,
          swap,
          magic,
          positionId,
          comment
        ];
      });
      sheet.getRange(lastUsedRowInRange + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    const result = {
      'status': 'success',
      'rows_added': newData.length
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    const errorResult = {
      'status': 'error',
      'message': error.toString()
    };
    
    return ContentService.createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to get the script URL
function getScriptURL() {
  return ScriptApp.getService().getUrl();
}

// Test function to verify script works
function test() {
  try {
    const testData = [
      {
        ticket: 123456,
        inTime: "2024.01.15 10:30:00",
        outTime: "2024.01.15 11:45:00",
        symbol: "EURUSD",
        type: "BUY",
        volume: 0.1,
        inPrice: 1.0850,
        outPrice: 1.0900,
        profit: 50.0,
        commission: -0.5,
        swap: 0.0,
        magic: 123456,
        positionId: 789012,
        comment: "Test trade"
      }
    ];
    
    const mockEvent = {
      postData: {
        contents: JSON.stringify(testData)
      }
    };
    
    const result = doPost(mockEvent);
    Logger.log("Test result: " + result.getContent());
    
    // Also try to access the sheet directly
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log("Sheet opened: " + ss.getName());
    const sheet = ss.getActiveSheet();
    Logger.log("Active sheet: " + sheet.getName());
    Logger.log("Last row: " + sheet.getLastRow());
    
  } catch (error) {
    Logger.log("Test error: " + error.toString());
  }
}

// Set up automatic trigger (run this once to enable)
function setupTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'autoSync') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new time-based trigger (runs every 5 minutes)
  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .everyMinutes(5)
    .create();
    
  Logger.log('Auto-sync trigger created - will run every 5 minutes');
}

// Automatic sync function (triggered by time-based trigger)
function autoSync() {
  // This function can be used for any automated tasks
  // Currently MT5 EA pushes data, so this is optional
  Logger.log('Auto-sync triggered at ' + new Date());
}
