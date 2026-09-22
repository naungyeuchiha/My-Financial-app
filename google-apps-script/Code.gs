const SPREADSHEET_ID = '';
const TRANSACTION_HEADERS = ['id', 'type', 'amount', 'date', 'category', 'note', 'createdAt'];
const CATEGORY_HEADERS = ['name', 'type', 'createdAt'];

function ss() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function out(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  try {
    if (action === 'ping') return out({ ok: true, message: 'Connected to Google Sheets' });
    if (action === 'status') return out({ ok: true, data: status() });
    if (action === 'getAll') return out({ ok: true, data: readAll() });
    return out({ ok: true, message: 'MoneyFlow Apps Script is online' });
  } catch (error) {
    return out({ ok: false, message: error.message || String(error) });
  }
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = request.action;
    if (action === 'ping') return out({ ok: true, message: 'Connected to Google Sheets' });
    if (action === 'status') return out({ ok: true, data: status() });
    if (action === 'getAll') return out({ ok: true, data: readAll() });
    if (action === 'replaceAll') {
      writeAll(request);
      return out({ ok: true, count: (request.transactions || []).length, data: status() });
    }
    return out({ ok: false, message: 'Unknown action' });
  } catch (error) {
    return out({ ok: false, message: error.message || String(error) });
  }
}

function sheet(name, headers) {
  const spreadsheet = ss();
  const result = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (result.getLastRow() === 0) {
    result.getRange(1, 1, 1, headers.length).setValues([headers]);
    result.setFrozenRows(1);
  }
  return result;
}

function rows(name, headers) {
  const values = sheet(name, headers).getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== ''; });
  }).map(function(row) {
    const object = {};
    headers.forEach(function(header, index) { object[header] = row[index]; });
    return object;
  });
}

function normalizeTransaction(item) {
  return {
    id: String(item.id || ''),
    type: String(item.type || 'expense'),
    amount: Number(item.amount || 0),
    date: formatDate(item.date),
    category: String(item.category || 'General'),
    note: String(item.note || ''),
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()
  };
}

function normalizeCategory(item) {
  return {
    name: String(item.name || '').trim(),
    type: String(item.type || 'expense'),
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()
  };
}

function uniqueCategories(categories) {
  const result = [];
  categories.forEach(function(item) {
    const category = normalizeCategory(item);
    if (!category.name) return;
    if (!result.some(function(existing) {
      return existing.name.toLowerCase() === category.name.toLowerCase() && existing.type === category.type;
    })) result.push(category);
  });
  return result;
}

function fingerprint(transactions, categories) {
  const transactionPart = transactions.map(function(item) {
    return [item.id, item.type, item.amount, item.date, item.category, item.note, item.createdAt].join('|');
  }).join('~');
  const categoryPart = categories.map(function(item) {
    return [item.name, item.type, item.createdAt].join('|');
  }).join('~');
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, transactionPart + '##' + categoryPart, Utilities.Charset.UTF_8);
  return hash.map(function(byte) {
    const value = (byte < 0 ? byte + 256 : byte).toString(16);
    return value.length === 1 ? '0' + value : value;
  }).join('');
}

function readAll() {
  const transactions = rows('Transactions', TRANSACTION_HEADERS).map(normalizeTransaction);
  const categories = uniqueCategories(rows('Categories', CATEGORY_HEADERS));
  return { transactions: transactions, categories: categories, revision: fingerprint(transactions, categories) };
}

function status() {
  const data = readAll();
  return { revision: data.revision, count: data.transactions.length, categoryCount: data.categories.length };
}

function writeAll(payload) {
  const transactions = (payload.transactions || []).map(normalizeTransaction);
  const categories = uniqueCategories(payload.categories || []);
  writeTable('Transactions', TRANSACTION_HEADERS, transactions.map(function(item) {
    return [item.id, item.type, item.amount, item.date, item.category, item.note, item.createdAt];
  }));
  writeTable('Categories', CATEGORY_HEADERS, categories.map(function(item) {
    return [item.name, item.type, item.createdAt];
  }));
}

function writeTable(name, headers, values) {
  const target = sheet(name, headers);
  target.clearContents();
  target.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (values.length) target.getRange(2, 1, values.length, headers.length).setValues(values);
  target.setFrozenRows(1);
}

function formatDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}
