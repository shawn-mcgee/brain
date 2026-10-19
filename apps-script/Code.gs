/* Brain backend. Configure Script Properties; see README.md. */
const COLUMNS = ['id', 'note', 'who', 'task', 'completed', 'completedDates', 'requires', 'beginsOn', 'beginsAt', 'endsOn', 'endsAt', 'repeat', 'budgetType', 'transactionType', 'amount', 'budgetId', 'createdAt', 'updatedAt'];

function doPost(event) {
  let lock;
  try {
    const body = JSON.parse(event.postData.contents);
    const properties = PropertiesService.getScriptProperties();
    const user = authorize_(body.token, properties);
    if (!['read', 'write'].includes(body.action)) throw new Error('Unknown action.');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('Another sync is in progress. Try again.');
    const book = SpreadsheetApp.openById(required_(properties, 'SPREADSHEET_ID'));
    let sheet = book.getSheetByName('Entries');
    if (!sheet) {
      sheet = book.insertSheet('Entries');
      sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
      sheet.setFrozenRows(1);
    }
    const headers = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
    if (JSON.stringify(headers) !== JSON.stringify(COLUMNS)) throw new Error('Entries sheet headers have changed. Restore the original headers before syncing.');
    let revision = Number(properties.getProperty('REVISION') || 0);
    if (body.action === 'write') {
      if (body.revision !== revision) return json_({ ok: false, code: 'CONFLICT', error: 'The Sheet changed in another browser. Pull and merge before retrying.' });
      validateEntries_(body.entries);
      const rows = body.entries.map(entry => COLUMNS.map(column => JSON.stringify(entry[column])));
      // Write the new snapshot before clearing trailing rows. JSON encoding prevents
      // user text from being interpreted as spreadsheet formulas or dates.
      if (rows.length) {
        if (sheet.getMaxRows() < rows.length + 1) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
        sheet.getRange(2, 1, rows.length, COLUMNS.length).setNumberFormat('@').setValues(rows);
      }
      const extra = sheet.getLastRow() - rows.length - 1;
      if (extra > 0) sheet.getRange(rows.length + 2, 1, extra, COLUMNS.length).clearContent();
      SpreadsheetApp.flush();
      revision++;
      properties.setProperty('REVISION', String(revision));
    }
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, COLUMNS.length).getValues() : [];
    const entries = rows.filter(row => row[0]).map(row => Object.fromEntries(COLUMNS.map((column, i) => [column, JSON.parse(row[i])])));
    return json_({ ok: true, entries: entries, revision: revision, user: user });
  } catch (error) {
    return json_({ ok: false, error: error.message || 'Request failed.' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function authorize_(token, properties) {
  if (typeof token !== 'string' || !token || token.length > 4096) throw new Error('Sign in with Google first.');
  // Never accept an email sent by the frontend. Ask Google who owns this token.
  const response = UrlFetchApp.fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('Your Google session expired. Sign in again.');
  const identity = JSON.parse(response.getContentText());
  const emails = required_(properties, 'ALLOWED_EMAILS').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  if (identity.email_verified !== true || typeof identity.email !== 'string' || !emails.includes(identity.email.toLowerCase())) throw new Error('This Google account is not on your family whitelist.');
  return { email: identity.email, name: identity.given_name || identity.name || identity.email };
}

function required_(properties, key) {
  const value = properties.getProperty(key);
  if (!value) throw new Error('Backend setup is incomplete: missing ' + key + '.');
  return value;
}

function validateEntries_(entries) {
  if (!Array.isArray(entries) || entries.length > 10000 || JSON.stringify(entries).length > 4000000) throw new Error('Too many entries or request too large.');
  const ids = new Set();
  const arrayFields = ['who', 'requires', 'completedDates'];
  entries.forEach(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid entry.');
    COLUMNS.filter(k => !arrayFields.includes(k) && !['task','completed','amount'].includes(k)).forEach(k => {
      if (typeof entry[k] !== 'string' || entry[k].length > 10000) throw new Error('Invalid entry field: ' + k);
    });
    arrayFields.forEach(k => { if (!Array.isArray(entry[k]) || entry[k].length > 120000 || entry[k].some(v => typeof v !== 'string' || v.length > 10000)) throw new Error('Invalid list: ' + k); });
    if (!entry.id || ids.has(entry.id) || !entry.note.trim() || typeof entry.task !== 'boolean' || typeof entry.completed !== 'boolean' || typeof entry.amount !== 'number' || !Number.isFinite(entry.amount) || entry.amount < 0) throw new Error('Invalid or duplicate entry.');
    if (!['','income','expense'].includes(entry.budgetType) || !['','income','expense'].includes(entry.transactionType) || entry.budgetType && entry.transactionType) throw new Error('Invalid financial type.');
    if (!['','Daily','Weekly','Monthly','Quarterly','Semi-annually','Annually'].includes(entry.repeat)) throw new Error('Invalid repeat interval.');
    [entry.beginsOn, entry.endsOn, ...entry.completedDates].filter(Boolean).forEach(value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31' || new Date(value + 'T12:00:00Z').toISOString().slice(0,10) !== value) throw new Error('Invalid date.');
    });
    [entry.beginsAt, entry.endsAt].filter(Boolean).forEach(value => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid time.'); });
    if (entry.beginsAt && !entry.beginsOn || entry.endsAt && !entry.endsOn || entry.repeat && !entry.beginsOn && !entry.endsOn) throw new Error('A date is required.');
    if (entry.beginsOn && entry.endsOn && (entry.endsOn < entry.beginsOn || entry.endsOn === entry.beginsOn && entry.beginsAt && entry.endsAt && entry.endsAt < entry.beginsAt)) throw new Error('Invalid date range.');
    ids.add(entry.id);
  });
  const map = new Map(entries.map(entry => [entry.id, entry]));
  const visiting = new Set(), visited = new Set();
  function visit(entry) {
    if (visiting.has(entry.id)) throw new Error('Dependency cycle.');
    if (visited.has(entry.id)) return;
    visiting.add(entry.id);
    entry.requires.forEach(id => { if (!map.has(id)) throw new Error('Missing dependency.'); visit(map.get(id)); });
    visiting.delete(entry.id); visited.add(entry.id);
  }
  entries.forEach(entry => {
    visit(entry);
    if (entry.budgetId) { const budget = map.get(entry.budgetId); if (!budget || budget.id === entry.id || !entry.transactionType || budget.budgetType !== entry.transactionType) throw new Error('Invalid budget link.'); }
  });
}

function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
