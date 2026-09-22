const SPREADSHEET_ID = '';

function ss() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function out(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') {
    return out({ ok: true, message: 'Connected to Google Sheets' });
  }
  if (action === 'getAll') {
    return out({ ok: true, data: readAll() });
  }
  return out({ ok: true, message: 'MoneyFlow Apps Script is online' });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = request.action;

    if (action === 'ping') {
      return out({ ok: true, message: 'Connected to Google Sheets' });
    }
    if (action === 'getAll') {
      return out({ ok: true, data: readAll() });
    }
    if (action === 'replaceAll') {
      writeAll(request);
      return out({ ok: true, count: (request.transactions || []).length });
    }

    return out({ ok: false, message: 'Unknown action' });
  } catch (error) {
    return out({ ok: false, message: error.message || String(error) });
  }
}

function sheet(name, headers) {
  const spreadsheet = ss();
  const existing = spreadsheet.getSheetByName(name);
  const result = existing || spreadsheet.insertSheet(name);
  if (result.getLastRow() === 0) {
    result.getRange(1, 1, 1, headers.length).setValues([headers]);
    result.setFrozenRows(1);
  }
  return result;
}

function rows(name, headers) {
  const values = sheet(name, headers).getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(function(row) { return row.some(function(value) { return value !== ''; }); })
    .map(function(row) {
      const object = {};
      headers.forEach(function(header, index) { object[header] = row[index]; });
      return object;
    });
}

function readAll() {
  const transactions = rows('Transactions', ['id', 'type', 'amount', 'date', 'category', 'note', 'createdAt'])
    .map(function(item) {
      return {
        id: String(item.id || ''),
        type: String(item.type || 'expense'),
        amount: Number(item.amount || 0),
        date: formatDate(item.date),
        category: String(item.category || 'General'),
        note: String(item.note || ''),
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()
      };
    });

  return {
    transactions: transactions,
    categories: transactions.reduce(function(list, transaction) {
      if (!list.some(function(category) { return category.name === transaction.category && category.type === transaction.type; })) {
        list.push({ name: transaction.category, type: transaction.type });
      }
      return list;
    }, [])
  };
}

function writeAll(payload) {
  const headers = ['id', 'type', 'amount', 'date', 'category', 'note', 'createdAt'];
  const transactions = payload.transactions || [];
  const target = sheet('Transactions', headers);
  target.clearContents();
  target.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (transactions.length) {
    target.getRange(2, 1, transactions.length, headers.length).setValues(
      transactions.map(function(item) {
        return [
          item.id || '',
          item.type || 'expense',
          Number(item.amount || 0),
          item.date || '',
          item.category || 'General',
          item.note || '',
          item.createdAt || new Date().toISOString()
        ];
      })
    );
  }
  target.setFrozenRows(1);
}

function formatDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}
