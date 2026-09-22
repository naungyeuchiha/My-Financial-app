const SPREADSHEET_ID = '';
const HEADERS = ['id', 'type', 'amount', 'date', 'category', 'note', 'createdAt'];

function ss() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
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
  if (action === 'status') {
    return out({ ok: true, data: status() });
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
    if (action === 'status') {
      return out({ ok: true, data: status() });
    }
    if (action === 'getAll') {
      return out({ ok: true, data: readAll() });
    }
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

function categoriesFromTransactions(transactions) {
  return transactions.reduce(function(list, transaction) {
    if (!list.some(function(category) {
      return category.name === transaction.category && category.type === transaction.type;
    })) {
      list.push({ name: transaction.category, type: transaction.type });
    }
    return list;
  }, []);
}

function fingerprint(transactions) {
  const normalized = transactions
    .map(function(item) {
      return [item.id, item.type, Number(item.amount || 0), item.date || '', item.category || 'General', item.note || '', item.createdAt || new Date().toISOString()].join('|');
    })
    .join('~');

  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    normalized,
    Utilities.Charset.UTF_8
  );

  return hash.map(function(byte) {
    const value = (byte < 0 ? byte + 256 : byte).toString(16);
    return value.length === 1 ? '0' + value : value;
  }).join('');
}

function readAll() {
  const transactions = rows('Transactions', HEADERS)
    .map(normalizeTransaction);

  return {
    transactions: transactions,
    categories: categoriesFromTransactions(transactions),
    revision: fingerprint(transactions)
  };
}

function status() {
  const data = readAll();
  return {
    revision: data.revision,
    count: data.transactions.length
  };
}

function writeAll(payload) {
  const transactions = payload.transactions || [];
  const target = sheet('Transactions', HEADERS);
  target.clearContents();
  target.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (transactions.length) {
    target.getRange(2, 1, transactions.length, HEADERS.length).setValues(
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
