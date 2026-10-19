/* Brain backend. Configure Script Properties; see README.md. */
const COLUMNS = ['id', 'note', 'who', 'task', 'completed', 'completedDates', 'requires', 'beginsOn', 'beginsAt', 'endsOn', 'endsAt', 'repeat', 'budgetType', 'transactionType', 'amount', 'budgetId', 'createdAt', 'updatedAt', 'boardItems', 'attachments', 'name', 'where', 'color', 'tags', 'group'];

function doPost(event) {
  let lock;
  try {
    const body = JSON.parse(event.postData.contents);
    const properties = PropertiesService.getScriptProperties();
    const user = authorize_(body.token, properties);
    if (!['read', 'write', 'file.get', 'file.put'].includes(body.action)) throw new Error('Unknown action.');
    const spreadsheetId = required_(properties, 'SPREADSHEET_ID');
    if (body.action.startsWith('file.')) return attachmentRequest_(body, spreadsheetId);
    if(body.action==='write'&&body.apiVersion!==6)return json_({ok:false,code:'UPGRADE_REQUIRED',error:'Reload the current app before syncing. This backend requires sync API version 6.'});
    if (body.action === 'write') body.entries = (body.entries || []).map(entry => normalizeEntryName_({...entry, boardItems: entry.boardItems || [], attachments: entry.attachments || []}));
    // Readers can use a previously committed snapshot without waiting for a writer.
    // Authenticate first; the shared cache contains no per-user credentials.
    if (body.action === 'read') {
      const cached = cachedSnapshot_(spreadsheetId, Number(properties.getProperty('REVISION') || 0));
      if (cached) return json_({ ok: true, apiVersion: 6, entries: cached.entries, boardViews:cached.boardViews||[], revision: cached.revision, user: user });
    } else { validateEntries_(body.entries); if(body.boardViews!==undefined) validateBoardViews_(body.boardViews); }
    lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return json_({ ok: false, code: 'BUSY', error: 'Another sync is in progress. Try again.' });
    const book = SpreadsheetApp.openById(spreadsheetId);
    let sheet = book.getSheetByName('Entries');
    if (!sheet) {
      sheet = book.insertSheet('Entries');
      sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
      sheet.setFrozenRows(1);
    }
    if (sheet.getMaxColumns() < COLUMNS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), COLUMNS.length - sheet.getMaxColumns());
    const headers = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
    if([18,20,21].some(width=>JSON.stringify(headers.slice(0,width))===JSON.stringify(COLUMNS.slice(0,width))&&headers.slice(width).every(value=>!value)))sheet.getRange(1,1,1,COLUMNS.length).setValues([COLUMNS]);
    else if(JSON.stringify(headers)!==JSON.stringify(COLUMNS))throw new Error('Entries sheet headers have changed. Restore the original headers before syncing.');
    let revision = Number(properties.getProperty('REVISION') || 0);
    const viewSheet=attachmentSheet_(book,'BoardViews',['id','item']);
    let boardViews=viewSheet.getLastRow()>1 ? viewSheet.getRange(2,2,viewSheet.getLastRow()-1,1).getValues().filter(row=>row[0]).map(row=>JSON.parse(row[0])) : [];
    const previousLastRow = sheet.getLastRow();
    let entries;
    if (body.action === 'write') {
      if (body.revision !== revision) return json_({ ok: false, code: 'CONFLICT', error: 'The Sheet changed in another browser. Pull and merge before retrying.' });
      const rows = body.entries.map(entry => COLUMNS.map(column => JSON.stringify(entry[column])));
      // Write the new snapshot before clearing trailing rows. JSON encoding prevents
      // user text from being interpreted as spreadsheet formulas or dates.
      if (rows.length) {
        if (sheet.getMaxRows() < rows.length + 1) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
        sheet.getRange(2, 1, rows.length, COLUMNS.length).setNumberFormat('@').setValues(rows);
      }
      const extra = previousLastRow - rows.length - 1;
      if (extra > 0) sheet.getRange(rows.length + 2, 1, extra, COLUMNS.length).clearContent();
      if(body.boardViews!==undefined) {
        boardViews=body.boardViews;
        const previousViews=viewSheet.getLastRow();
        if(boardViews.length) {
          if(viewSheet.getMaxRows()<boardViews.length+1)viewSheet.insertRowsAfter(viewSheet.getMaxRows(),boardViews.length+1-viewSheet.getMaxRows());
          viewSheet.getRange(2,1,boardViews.length,2).setNumberFormat('@').setValues(boardViews.map(item=>[JSON.stringify(item.id),JSON.stringify(item)]));
        }
        if(previousViews>boardViews.length+1)viewSheet.getRange(boardViews.length+2,1,previousViews-boardViews.length-1,2).clearContent();
      }
      SpreadsheetApp.flush();
      revision++;
      properties.setProperty('REVISION', String(revision));
      entries = body.entries.map(entry => Object.fromEntries(COLUMNS.map(column => [column, entry[column]])));
    } else {
      const rows = previousLastRow > 1 ? sheet.getRange(2, 1, previousLastRow - 1, COLUMNS.length).getValues() : [];
      entries = rows.filter(row => row[0]).map(row => normalizeEntryName_(Object.fromEntries(COLUMNS.map((column, i) => [column, i>=20&&!row[i]?undefined:i >= 18 && i<20 && !row[i] ? [] : JSON.parse(row[i])]))));
      if(rows.some(row=>row[0]&&[20,21,22,23,24].some(index=>!row[index]))) {
        sheet.getRange(2,1,entries.length,COLUMNS.length).setNumberFormat('@').setValues(entries.map(entry=>COLUMNS.map(column=>JSON.stringify(entry[column]))));
        // Persist the migration under the same lock and invalidate older writers.
        if(previousLastRow>entries.length+1)sheet.getRange(entries.length+2,1,previousLastRow-entries.length-1,COLUMNS.length).clearContent();
        SpreadsheetApp.flush();
        revision++;
        properties.setProperty('REVISION',String(revision));
      }
    }
    cacheSnapshot_(spreadsheetId, { entries: entries, boardViews:boardViews, revision: revision });
    return json_({ ok: true, apiVersion: 6, entries: entries, boardViews:boardViews, revision: revision, user: user });
  } catch (error) {
    return json_({ ok: false, error: error.message || 'Request failed.' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function cachedSnapshot_(spreadsheetId, revision) {
  try {
    const raw = CacheService.getScriptCache().get('brain:v6:' + spreadsheetId + ':' + revision);
    const snapshot = raw ? JSON.parse(raw) : null;
    return snapshot && snapshot.revision === revision && Array.isArray(snapshot.entries) ? snapshot : null;
  } catch (_) { return null; } // Cache eviction/unavailability is harmless.
}
function cacheSnapshot_(spreadsheetId, snapshot) {
  try {
    const value = JSON.stringify(snapshot);
    // Conservative limit stays below CacheService's 100 KB per value, even for emoji.
    if (value.length < 22000) CacheService.getScriptCache().put('brain:v6:' + spreadsheetId + ':' + snapshot.revision, value, 120);
  } catch (_) { /* A committed write must not fail because caching is unavailable. */ }
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
  const arrayFields = ['who', 'requires', 'completedDates', 'tags'];
  const metadataFields = ['boardItems','attachments'];
  entries.forEach(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid entry.');
    COLUMNS.filter(k => !arrayFields.includes(k) && !metadataFields.includes(k) && !['task','completed','amount'].includes(k)).forEach(k => {
      if (typeof entry[k] !== 'string' || entry[k].length > 10000) throw new Error('Invalid entry field: ' + k);
    });
    arrayFields.forEach(k => { if (!Array.isArray(entry[k]) || entry[k].length > 120000 || entry[k].some(v => typeof v !== 'string' || v.length > 10000)) throw new Error('Invalid list: ' + k); });
    if (!entry.id || ids.has(entry.id) || !entry.name.trim() || typeof entry.task !== 'boolean' || typeof entry.completed !== 'boolean' || typeof entry.amount !== 'number' || !Number.isFinite(entry.amount) || entry.amount < 0) throw new Error('Invalid or duplicate entry.');
    if (!['','income','expense'].includes(entry.budgetType) || !['','income','expense'].includes(entry.transactionType) || entry.budgetType && entry.transactionType) throw new Error('Invalid financial type.');
    if (!['','Daily','Weekly','Monthly','Quarterly','Semi-annually','Annually'].includes(entry.repeat)) throw new Error('Invalid repeat interval.');
    [entry.beginsOn, entry.endsOn, ...entry.completedDates].filter(Boolean).forEach(value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31' || new Date(value + 'T12:00:00Z').toISOString().slice(0,10) !== value) throw new Error('Invalid date.');
    });
    [entry.beginsAt, entry.endsAt].filter(Boolean).forEach(value => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid time.'); });
    if (entry.beginsAt && !entry.beginsOn || entry.endsAt && !entry.endsOn || entry.repeat && !entry.beginsOn && !entry.endsOn) throw new Error('A date is required.');
    if (entry.beginsOn && entry.endsOn && (entry.endsOn < entry.beginsOn || entry.endsOn === entry.beginsOn && entry.beginsAt && entry.endsAt && entry.endsAt < entry.beginsAt)) throw new Error('Invalid date range.');
    if(entry.color&&!['yellow','pink','blue','green','white','purple','orange','gray'].includes(entry.color)||entry.tags.length>200||entry.tags.some(tag=>tag.length>500))throw new Error('Invalid entry color or tags.');
    validateMetadata_(entry);
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

function validateMetadata_(entry) {
  if (!Array.isArray(entry.boardItems) || entry.boardItems.length > 100 || !Array.isArray(entry.attachments) || entry.attachments.length > 20) throw new Error('Invalid board items or attachments.');
  const ids = new Set();
  entry.boardItems.forEach(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length>100 || ids.has(item.id) || !['sticky','polaroid','calendar','group'].includes(item.kind) || !['yellow','pink','blue','green','white','purple','orange','gray'].includes(item.color) || !['x','y','width','height','z'].every(k => typeof item[k] === 'number' && Number.isFinite(item[k]) && Math.abs(item[k]) <= 10000000) || item.width < 220 || item.width > 1200 || item.height < 180 || item.height > 1200) throw new Error('Invalid board layout.');
    if (['pinned','archived','calendarDynamic','customColor','collapsed'].some(k=>item[k]!==undefined&&typeof item[k]!=='boolean') || item.title!==undefined&&(typeof item.title!=='string'||item.title.length>10000) || item.calendarPeriod!==undefined&&!['day','week','month'].includes(item.calendarPeriod) || item.calendarDate!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(item.calendarDate)||item.calendarDate<'1900-01-01'||item.calendarDate>'2200-12-31'||!Number.isFinite(Date.parse(item.calendarDate))||new Date(item.calendarDate+'T12:00:00Z').toISOString().slice(0,10)!==item.calendarDate)) throw new Error('Invalid board options.');
    ids.add(item.id);
  });
  ids.clear();
  entry.attachments.forEach(file => { validateFileMetadata_(file); if (ids.has(file.id)) throw new Error('Duplicate attachment.'); ids.add(file.id); });
  // Keep each JSON metadata cell comfortably below Sheets' cell size limit.
  if (JSON.stringify(entry.boardItems).length > 40000 || JSON.stringify(entry.attachments).length > 40000) throw new Error('Entry metadata is too large.');
}
function validateFileMetadata_(file) {
  if (!file || typeof file.id !== 'string' || !/^[\w-]{1,100}$/.test(file.id) || typeof file.name !== 'string' || !file.name || file.name.length > 500 || typeof file.type !== 'string' || !/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(file.type) || !Number.isInteger(file.size) || file.size < 0 || file.size > 2097152 || typeof file.createdAt !== 'string' || !Number.isFinite(Date.parse(file.createdAt)) || 'dataUrl' in file || 'data' in file) throw new Error('Invalid attachment metadata (2 MB maximum).');
}
function attachmentSheet_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) { sheet = book.insertSheet(name); sheet.getRange(1,1,1,headers.length).setValues([headers]); sheet.setFrozenRows(1); }
  if (JSON.stringify(sheet.getRange(1,1,1,headers.length).getValues()[0]) !== JSON.stringify(headers)) throw new Error(name + ' sheet headers have changed.');
  return sheet;
}
function attachmentRequest_(body, spreadsheetId) {
  let lock;
  try {
    if (typeof body.entryId !== 'string' || !body.entryId || body.entryId.length > 100) throw new Error('Invalid attachment entry.');
    if (body.action === 'file.put') {
      validateFileMetadata_(body.metadata);
      const prefix = 'data:' + body.metadata.type + ';base64,';
      if (typeof body.dataUrl !== 'string' || !body.dataUrl.startsWith(prefix)) throw new Error('Invalid data URL.');
      const base64 = body.dataUrl.slice(prefix.length);
      if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length * 3 / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0) !== body.metadata.size) throw new Error('Attachment size or encoding does not match.');
    } else if (typeof body.id !== 'string' || !/^[\w-]{1,100}$/.test(body.id)) throw new Error('Invalid file ID.');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return json_({ok:false,code:'BUSY',error:'Another sync is in progress. Try again.'});
    const book = SpreadsheetApp.openById(spreadsheetId);
    const index = attachmentSheet_(book,'Attachments',['id','entryId','name','type','size','createdAt','startRow','chunkCount']);
    const data = attachmentSheet_(book,'AttachmentData',['id','chunk','dataUrl']);
    const rows = index.getLastRow() > 1 ? index.getRange(2,1,index.getLastRow()-1,8).getValues().map(row => row.map(value => JSON.parse(value))) : [];
    const id = body.action === 'file.put' ? body.metadata.id : body.id;
    const existing = rows.find(row => row[0] === id);
    if (body.action === 'file.get') {
      if (!existing) throw new Error('Attachment not found.');
      const chunks = data.getRange(existing[6],1,existing[7],3).getValues().map(row => row.map(value => JSON.parse(value)));
      if (chunks.some((row,i) => row[0] !== id || row[1] !== i)) throw new Error('Attachment chunks are incomplete.');
      return json_({ok:true,apiVersion:2,dataUrl:chunks.map(row => row[2]).join('')});
    }
    if (existing) {
      const file = body.metadata;
      if (existing[1] !== body.entryId || existing[2] !== file.name || existing[3] !== file.type || existing[4] !== file.size || existing[5] !== file.createdAt) throw new Error('Attachment IDs are immutable.');
      return json_({ok:true,apiVersion:2});
    }
    const chunks = [];
    for (let i=0; i<body.dataUrl.length; i+=40000) chunks.push([id,chunks.length,body.dataUrl.slice(i,i+40000)].map(value => JSON.stringify(value)));
    const startRow = data.getLastRow()+1;
    if (data.getMaxRows() < startRow+chunks.length-1) data.insertRowsAfter(data.getMaxRows(),startRow+chunks.length-1-data.getMaxRows());
    data.getRange(startRow,1,chunks.length,3).setNumberFormat('@').setValues(chunks);
    SpreadsheetApp.flush();
    const file = body.metadata;
    const row = [id,body.entryId,file.name,file.type,file.size,file.createdAt,startRow,chunks.length].map(value => JSON.stringify(value));
    const indexRow=index.getLastRow()+1;
    if(index.getMaxRows()<indexRow)index.insertRowsAfter(index.getMaxRows(),1);
    index.getRange(indexRow,1,1,8).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();
    return json_({ok:true,apiVersion:2});
  } catch(error) { return json_({ok:false,error:error.message||'Attachment request failed.'}); }
  finally { if(lock && lock.hasLock())lock.releaseLock(); }
}

function validateBoardViews_(items) {
  if(!Array.isArray(items)||items.some(item=>!item||!['calendar','group'].includes(item.kind)))throw new Error('Invalid board views: expected calendar or group.');
  validateMetadata_({boardItems:items,attachments:[]});
}

function normalizeEntryName_(entry) {
  entry={where:'',color:'',tags:[],group:'',...entry};
  ['where','color','group'].forEach(key=>{if(entry[key]===undefined)entry[key]='';});
  if(entry.tags===undefined)entry.tags=[];
  if(entry.name===undefined&&typeof entry.note==='string') {
    const lines=entry.note.trim().split(/\r?\n/);
    return {...entry,name:lines[0],note:lines.slice(1).join('\n')};
  }
  return entry;
}
