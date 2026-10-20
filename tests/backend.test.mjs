import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { blankEntry } from "../src/domain.ts";
import {SYNC_API_VERSION} from '../src/backend-protocol.ts';
import { newBoardItem } from '../src/board-model.ts';
const source = fs.readFileSync(
  new URL("../apps-script/Code.gs", import.meta.url),
  "utf8",
);
function backend() {
  const cache = new Map(),
    lockWaits = [];
  let externalBusy = false,
    releases = 0;
  const properties = new Map([
    ["SPREADSHEET_ID", "test-sheet"],
    ["ALLOWED_EMAILS", "one@gmail.com, TWO@gmail.com"],
  ]);
  const cells = [];
  const sheets = new Map();
  let reads = 0;
  function makeSheet(cells) { return {
    getMaxColumns: () => 26,
    insertColumnsAfter: () => {},
    insertRowsAfter: () => {},
    getLastRow: () => cells.findLastIndex((row) => row.some(Boolean)) + 1,
    getMaxRows: () => 1000,
    setFrozenRows: () => {},
    getRange: (r, c, h, w) => ({
      getValues: () =>
        Array.from({ length: h }, (_, y) =>
          Array.from(
            { length: w },
            (_, x) => cells[r + y - 1]?.[c + x - 1] ?? "",
          ),
        ),
      setNumberFormat() {
        return this;
      },
      setValues: (rows) =>
        rows.forEach((row, y) => {
          cells[r + y - 1] = row;
        }),
      clearContent: () => {
        for (let y = 0; y < h; y++) cells[r + y - 1] = Array(w).fill("");
      },
    }),
  }; }
  const context = vm.createContext({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => properties.get(k),
        setProperty: (k, v) => properties.set(k, v),
      }),
    },
    UrlFetchApp: {
      fetch: (_url, options) => {
        const identities = {
          "Bearer one": {
            email: "one@gmail.com",
            email_verified: true,
            given_name: "One",
          },
          "Bearer two": { email: "two@gmail.com", email_verified: true },
          "Bearer outsider": { email: "other@gmail.com", email_verified: true },
          "Bearer unverified": {
            email: "one@gmail.com",
            email_verified: false,
          },
        };
        const identity = identities[options.headers.Authorization];
        return {
          getResponseCode: () => (identity ? 200 : 401),
          getContentText: () => JSON.stringify(identity || {}),
        };
      },
    },
    LockService: {
      getScriptLock: () => {
        let acquired = false;
        return {
          tryLock: (ms) => {
            lockWaits.push(ms);
            acquired = !externalBusy;
            return acquired;
          },
          hasLock: () => acquired,
          releaseLock: () => {
            acquired = false;
            releases++;
          },
        };
      },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache.get(key) || null,
        put: (key, value) => cache.set(key, value),
      }),
    },
    SpreadsheetApp: {
      openById: () => {
        reads++;
        return {
          getSheetByName: name => {
            // Seeded cells represent an existing Entries sheet, not a new sheet.
            if(name==='Entries'&&cells.length&&!sheets.has(name))sheets.set(name,{rows:cells,instance:makeSheet(cells)});
            return sheets.get(name)?.instance || null;
          },
          insertSheet: name => { const rows=name==="Entries"?cells:[]; const instance=makeSheet(rows); sheets.set(name,{rows,instance}); return instance; },
        };
      },
      flush: () => {},
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ setMimeType: () => text }),
    },
  });
  vm.runInContext(source, context);
  const call = (body) =>
    JSON.parse(
      context.doPost({ postData: { contents: JSON.stringify({apiVersion:SYNC_API_VERSION,...body}) } }),
    );
  return {
    call,
    cells,
    sheetCells: name => sheets.get(name)?.rows,
    clearCache: () => cache.clear(),
    reads: () => reads,
    setBusy: (busy) => {
      externalBusy = busy;
    },
    lockWaits,
    releases: () => releases,
  };
}
test("busy cold reads return a retryable code quickly without touching the Sheet", () => {
  const api = backend();
  api.setBusy(true);
  const result = api.call({ action: "read", token: "one" });
  assert.equal(result.code, "BUSY");
  assert.equal(api.reads(), 0);
  assert.deepEqual(api.lockWaits, [1000]);
  assert.equal(api.releases(), 0);
  api.setBusy(false);
  assert.equal(api.call({ action: "read", token: "one" }).ok, true);
  assert.equal(api.releases(), 1);
});
test("authorized readers use committed cached snapshots while a writer holds the lock", () => {
  const api = backend(),
    e = { ...blankEntry(), name: "Shared" };
  api.call({ action: "write", token: "one", revision: 0, entries: [e] });
  const reads = api.reads();
  api.setBusy(true);
  const result = api.call({ action: "read", token: "two" });
  assert.deepEqual(result.entries, [e]);
  assert.equal(result.revision, 1);
  assert.equal(result.user.email, "two@gmail.com");
  assert.equal(api.reads(), reads);
  assert.equal(api.call({ action: "read", token: "outsider" }).ok, false);
});
test("GAS fails closed before reading the Sheet for missing, invalid, unverified and non-whitelisted credentials", () => {
  const api = backend();
  for (const token of ["", "fake", "outsider", "unverified"])
    assert.equal(
      api.call({ action: "read", token, email: "one@gmail.com" }).ok,
      false,
    );
  assert.equal(api.reads(), 0);
  assert.equal(api.call({ action: "read", token: "one" }).ok, true);
  assert.equal(api.call({ action: "read", token: "two" }).ok, true);
});
test("GAS serializes text safely and rejects stale writes from another spouse", () => {
  const api = backend(),
    e = { ...blankEntry(), name: '=IMPORTXML("https://example.com")' };
  assert.equal(api.call({ action: "read", token: "one" }).revision, 0);
  const saved = api.call({
    action: "write",
    token: "one",
    revision: 0,
    entries: [e],
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.revision, 1);
  assert.equal(api.cells[1][20].startsWith('"'), true);
  assert.deepEqual(saved.entries, [e]);
  const stale = api.call({
    action: "write",
    token: "two",
    revision: 0,
    entries: [],
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "CONFLICT");
  assert.match(stale.error, /another browser/);
  assert.equal(api.call({ action: "read", token: "two" }).entries.length, 1);
});
test("GAS validates dependencies and can clear the final entry", () => {
  const api = backend(),
    e = { ...blankEntry(), name: "A task", requires: ["missing"] };
  assert.equal(
    api.call({ action: "write", token: "one", revision: 0, entries: [e] }).ok,
    false,
  );
  e.requires = [];
  assert.equal(
    api.call({ action: "write", token: "one", revision: 0, entries: [e] }).ok,
    true,
  );
  assert.deepEqual(
    api.call({ action: "write", token: "two", revision: 1, entries: [] })
      .entries,
    [],
  );
});

test("legacy Entries headers and rows migrate without losing entry data", () => {
  const api=backend(), entry={...blankEntry(),name:'Existing data'};
  assert.equal(api.call({action:'write',token:'one',revision:0,entries:[entry]}).ok,true);
  api.cells[0]=api.cells[0].slice(0,18);
  api.cells[1][1]=JSON.stringify(entry.name);
  api.cells[1]=api.cells[1].slice(0,18);
  api.clearCache();
  const result=api.call({action:'read',token:'two'});
  assert.equal(result.ok,true);
  assert.equal(result.apiVersion,SYNC_API_VERSION);
  assert.deepEqual(result.entries,[entry]);
  assert.deepEqual(Array.from(api.cells[0].slice(20)),['name','where','color','tags','group','list','repeatUntil','budgetOrder','budgetGroupOrder','pin','pinOrder']);
});

test("attachments round-trip in chunks and ordinary sync returns metadata only", () => {
  const api=backend(), entry={...blankEntry(),name:'Photo'};
  const bytes=Buffer.alloc(2097152,123), dataUrl='data:image/png;base64,'+bytes.toString('base64');
  const metadata={id:'file-one',name:'=photo.png',type:'image/png',size:bytes.length,createdAt:new Date().toISOString()};
  const put={action:'file.put',token:'one',entryId:entry.id,metadata,dataUrl};
  assert.equal(api.call(put).ok,true);
  const rows=api.sheetCells('AttachmentData').length;
  assert.ok(rows>2);
  assert.ok(api.sheetCells('AttachmentData').slice(1).every(row=>row[2].length<50000));
  assert.equal(api.call(put).ok,true);
  assert.equal(api.sheetCells('AttachmentData').length,rows);
  entry.attachments=[metadata];
  assert.equal(api.call({action:'write',token:'one',revision:0,entries:[entry]}).ok,true);
  const ordinary=api.call({action:'read',token:'two'});
  assert.deepEqual(ordinary.entries,[entry]);
  assert.ok(!JSON.stringify(ordinary).includes(';base64,'));
  const fetched=api.call({action:'file.get',token:'two',entryId:entry.id,id:metadata.id});
  assert.equal(fetched.dataUrl,dataUrl);
  // Preserved concurrent versions can share immutable file IDs.
  assert.equal(api.call({action:'file.get',token:'two',entryId:'copy',id:metadata.id}).dataUrl,dataUrl);
  assert.equal(api.call({...put,entryId:'different-owner'}).ok,false);
});

test("file requests enforce whitelist, size, encoding, and lock retry protocol", () => {
  const api=backend(), metadata={id:'file',name:'a.txt',type:'text/plain',size:1,createdAt:new Date().toISOString()};
  const put={action:'file.put',token:'one',entryId:'entry',metadata,dataUrl:'data:text/plain;base64,YQ=='};
  assert.equal(api.call({...put,token:'outsider'}).ok,false);
  assert.equal(api.reads(),0);
  assert.equal(api.call({...put,metadata:{...metadata,size:2097153}}).ok,false);
  assert.equal(api.call({...put,dataUrl:'data:text/plain;base64,!!!!'}).ok,false);
  assert.equal(api.call({...put,metadata:{...metadata,size:2}}).ok,false);
  assert.equal(api.reads(),0);
  api.setBusy(true);
  assert.equal(api.call(put).code,'BUSY');
  api.setBusy(false);
  assert.equal(api.call(put).ok,true);
  assert.equal(api.call({action:'file.get',token:'one',entryId:'entry',id:'missing'}).ok,false);
});

test('standalone calendar views share revision checks and cached reads without creating entries',()=>{
  const api=backend(),calendar=newBoardItem('calendar');
  const saved=api.call({action:'write',token:'one',revision:0,entries:[],boardViews:[calendar]});
  assert.equal(saved.ok,true);
  assert.deepEqual(saved.entries,[]);
  assert.deepEqual(saved.boardViews,[calendar]);
  assert.equal(saved.revision,1);
  assert.equal(api.sheetCells('BoardViews').length,2);
  api.setBusy(true);
  assert.deepEqual(api.call({action:'read',token:'two'}).boardViews,[calendar]);
  api.setBusy(false);
  assert.equal(api.call({action:'write',token:'two',revision:0,entries:[],boardViews:[]}).code,'CONFLICT');
  // An older client omitting boardViews cannot erase independently stored views.
  assert.deepEqual(api.call({action:'write',token:'one',revision:1,entries:[]}).boardViews,[calendar]);
  api.clearCache();
  assert.deepEqual(api.call({action:'read',token:'two'}).boardViews,[calendar]);
  assert.equal(api.call({action:'write',token:'one',revision:2,entries:[],boardViews:[]}).ok,true);
  api.clearCache();
  assert.deepEqual(api.call({action:'read',token:'two'}).boardViews,[]);
});

test('legacy BoardViews item headers migrate without changing saved calendars or groups',()=>{
  const api=backend(),views=[newBoardItem('calendar'),{...newBoardItem('group'),title:'Family',collapsed:true}];
  const saved=api.call({action:'write',token:'one',revision:0,entries:[],boardViews:views});
  assert.equal(saved.ok,true);
  const cells=api.sheetCells('BoardViews'),rows=JSON.stringify(cells.slice(1));
  cells[0]=['id','item'];api.clearCache();
  const read=api.call({action:'read',token:'two'});
  assert.equal(read.ok,true);assert.deepEqual(read.boardViews,views);
  assert.equal(read.revision,saved.revision);
  assert.deepEqual(Array.from(cells[0]),['id','thought']);
  assert.equal(JSON.stringify(cells.slice(1)),rows);
  api.clearCache();assert.deepEqual(api.call({action:'read',token:'one'}).boardViews,views);
  // A write that omits boardViews must preserve legacy saved views too.
  cells[0]=['id','item'];api.clearCache();
  const written=api.call({action:'write',token:'one',revision:read.revision,entries:[]});
  assert.equal(written.ok,true);assert.deepEqual(written.boardViews,views);
  assert.equal(JSON.stringify(cells.slice(1)),rows);
});

test('unrecognized BoardViews headers still fail without overwriting saved views',()=>{
  const api=backend();
  assert.equal(api.call({action:'write',token:'one',revision:0,entries:[],boardViews:[newBoardItem('calendar')]}).ok,true);
  const cells=api.sheetCells('BoardViews');cells[0]=['id','unexpected'];api.clearCache();
  const before=JSON.stringify(cells);
  assert.match(api.call({action:'read',token:'one'}).error,/BoardViews sheet headers have changed/);
  assert.equal(JSON.stringify(cells),before);
});

test('backend persists palette, pins, and archives, and rejects invalid board settings',()=>{
  const api=backend(),entry={...blankEntry(),name:'Card',boardItems:[{...newBoardItem('sticky'),color:'orange',pinned:true,archived:true}]};
  assert.equal(api.call({action:'write',token:'one',revision:0,entries:[entry]}).ok,true);
  api.clearCache();
  assert.deepEqual(api.call({action:'read',token:'two'}).entries,[entry]);
  for(const patch of [{pinned:'yes'},{calendarPeriod:'year'},{calendarDate:'2026-02-30'},{archived:1}]) {
    assert.equal(api.call({action:'write',token:'one',revision:1,entries:[],boardViews:[{...newBoardItem('calendar'),...patch}]}).ok,false);
  }
});

test('backend permits identical names with separate IDs and an empty note',()=>{
  const api=backend(),first={...blankEntry(),name:'Same name'},second={...blankEntry(),name:'Same name',note:'Optional body'};
  const result=api.call({action:'write',token:'one',revision:0,entries:[first,second]});
  assert.equal(result.ok,true);
  assert.deepEqual(result.entries,[first,second]);
  assert.equal(api.call({action:'write',token:'one',revision:1,entries:[{...first,name:''}]}).ok,false);
});

test('20-column Sheets migrate names without changing IDs, files, or card metadata',()=>{
  const api=backend(),entry={...blankEntry(),name:'Legacy name',note:'Legacy body',boardItems:[newBoardItem('sticky')]};
  api.call({action:'write',token:'one',revision:0,entries:[entry]});
  api.cells[0]=api.cells[0].slice(0,20);
  api.cells[1]=api.cells[1].slice(0,20);
  api.cells[1][1]=JSON.stringify('Legacy name\nLegacy body');
  api.clearCache();
  const result=api.call({action:'read',token:'two'});
  assert.equal(result.ok,true);
  assert.deepEqual(result.entries,[entry]);
  assert.equal(api.cells[0][20],'name');
  assert.equal(JSON.parse(api.cells[1][20]),'Legacy name');
  assert.equal(JSON.parse(api.cells[1][1]),'Legacy body');
  assert.equal(result.revision,2);
});

test('entry enhancements and group widget state survive sync and reject malformed values',()=>{
  const api=backend(),entry={...blankEntry(),name:'Dinner',where:'The library',color:'blue',tags:['family','book club'],group:'Evening'};
  const group={...newBoardItem('group'),title:'Evening',pinned:true,collapsed:true};
  const saved=api.call({action:'write',token:'one',revision:0,entries:[entry],boardViews:[group]});
  assert.equal(saved.ok,true);
  api.clearCache();
  const read=api.call({action:'read',token:'two'});
  assert.deepEqual(read.entries,[entry]);assert.deepEqual(read.boardViews,[group]);
  for(const patch of [{color:'red'},{tags:[42]},{where:[]},{group:[]},{tags:Array(201).fill('tag')}])assert.equal(api.call({action:'write',token:'one',revision:1,entries:[{...entry,...patch}]}).ok,false);
});

test('21-column workspaces add attribute defaults and retain IDs and notes',()=>{
  const api=backend(),entry={...blankEntry(),name:'Existing name',note:'Keep this body'};
  api.call({action:'write',token:'one',revision:0,entries:[entry]});
  api.cells[0]=api.cells[0].slice(0,21);api.cells[1]=api.cells[1].slice(0,21);api.clearCache();
  const read=api.call({action:'read',token:'two'});
  assert.equal(read.ok,true);assert.deepEqual(read.entries,[entry]);assert.equal(read.revision,2);
  assert.equal(JSON.parse(api.cells[1][21]),'');assert.deepEqual(JSON.parse(api.cells[1][23]),[]);
});

test('outdated clients cannot write before upgrading, leaving existing board groups intact',()=>{
  const api=backend(),group={...newBoardItem('group'),title:'Family',collapsed:true};
  assert.equal(api.call({action:'write',token:'one',revision:0,entries:[],boardViews:[group]}).ok,true);
  const reads=api.reads();
  for(const apiVersion of [undefined,4,5,8]) {
    assert.equal(api.call({action:'write',token:'two',apiVersion,revision:1,entries:[],boardViews:[]}).code,'UPGRADE_REQUIRED');
  }
  assert.equal(api.reads(),reads);
  const result=api.call({action:'read',token:'one'});
  assert.deepEqual(result.boardViews,[group]);
  assert.equal(result.revision,1);
  assert.equal(result.apiVersion,SYNC_API_VERSION);
});


test('checklists migrate from 25 columns, round-trip, and validate line data',()=>{
  const api=backend(),entry={...blankEntry(),name:'Checklist',task:true,list:[{id:'line',text:'Wash dishes',completed:false,completedDates:[]}]};
  const write=api.call({action:'write',token:'one',revision:0,entries:[entry]});
  assert.equal(write.ok,true);assert.equal(api.cells[0][25],'list');
  assert.equal(api.call({action:'read',token:'one'}).entries[0].list[0].text,'Wash dishes');
  const bad={...entry,list:[{...entry.list[0],completed:'yes'}]};
  assert.equal(api.call({action:'write',token:'one',revision:write.revision,entries:[bad]}).ok,false);
  // Simulate the previous schema and a cold cache.
  const legacy=backend();legacy.cells.push(api.cells[0].slice(0,25),api.cells[1].slice(0,25));
  const migrated=legacy.call({action:'read',token:'one'});
  assert.equal(migrated.ok,true);assert.equal(migrated.apiVersion,SYNC_API_VERSION);
  assert.deepEqual(migrated.entries[0].list,[]);assert.equal(legacy.cells[0][25],'list');
  assert.equal(legacy.call({action:'write',token:'one',apiVersion:6,revision:migrated.revision,entries:[]}).code,'UPGRADE_REQUIRED');
});


test('When and repeat limits migrate from version 7 Sheets and round-trip',()=>{
  const api=backend(),entry={...blankEntry(),name:'Plan',beginsOn:'2026-10-19',repeat:'Daily',repeatUntil:'2026-10-21'};
  const written=api.call({action:'write',token:'one',revision:0,entries:[entry]});
  assert.equal(written.ok,true);
  assert.equal(written.entries[0].endsOn,entry.beginsOn);
  assert.equal(written.entries[0].repeatUntil,'2026-10-21');
  const cold=backend();cold.cells.push(api.cells[0].slice(0,26),api.cells[1].slice(0,26));
  const migrated=cold.call({action:'read',token:'one'});
  assert.equal(migrated.ok,true);assert.equal(migrated.entries[0].repeatUntil,'');
  assert.equal(cold.cells[0][26],'repeatUntil');
  assert.equal(cold.cells[1][26],JSON.stringify(''));
  assert.deepEqual(Array.from(cold.cells[1].slice(0,26)),Array.from(api.cells[1].slice(0,26)));
  assert.equal(migrated.revision,1);
  cold.clearCache();
  assert.equal(cold.call({action:'read',token:'one'}).revision,migrated.revision);
  assert.equal(cold.call({action:'write',token:'one',revision:0,entries:migrated.entries}).code,'CONFLICT');
  const invalid=api.call({action:'write',token:'one',revision:written.revision,entries:[{...entry,repeatUntil:'2026-10-18'}]});
  assert.equal(invalid.ok,false);
  assert.equal(api.call({action:'write',token:'one',apiVersion:7,revision:written.revision,entries:[]}).code,'UPGRADE_REQUIRED');
});


test('an empty 26-column sheet upgrades while altered headers remain protected',()=>{
  const seed=backend();assert.equal(seed.call({action:'read',token:'one'}).ok,true);
  const oldHeaders=seed.cells[0].slice(0,26);
  const empty=backend();empty.cells.push([...oldHeaders]);
  const upgraded=empty.call({action:'read',token:'one'});
  assert.equal(upgraded.ok,true);assert.deepEqual(upgraded.entries,[]);
  assert.equal(empty.cells[0][26],'repeatUntil');
  const altered=backend();altered.cells.push([...oldHeaders]);altered.cells[0][25]='renamed list';
  const before=structuredClone(altered.cells);
  assert.match(altered.call({action:'read',token:'one'}).error,/headers have changed/);
  assert.deepEqual(altered.cells,before);
});

test('budget order round-trips and version 8 Sheets migrate without losing budgets',()=>{
  const api=backend(),entry={...blankEntry(),name:'Rent',group:'Home',budgetType:'expense',amount:1200,budgetOrder:2,budgetGroupOrder:1};
  const written=api.call({action:'write',token:'one',revision:0,entries:[entry]});
  assert.equal(written.ok,true);assert.deepEqual(written.entries,[entry]);
  api.clearCache();
  assert.deepEqual(api.call({action:'read',token:'two'}).entries,[entry]);
  const legacy=backend();legacy.cells.push(api.cells[0].slice(0,27),api.cells[1].slice(0,27));
  const migrated=legacy.call({action:'read',token:'one'});
  assert.equal(migrated.ok,true);
  assert.deepEqual(migrated.entries,[{...entry,budgetOrder:-1,budgetGroupOrder:-1}]);
  assert.deepEqual(Array.from(legacy.cells[0].slice(27)),['budgetOrder','budgetGroupOrder','pin','pinOrder']);
  assert.equal(migrated.revision,1);
  legacy.clearCache();assert.equal(legacy.call({action:'read',token:'one'}).revision,1);
  const invalid=api.call({action:'write',token:'one',revision:written.revision,entries:[{...entry,budgetOrder:1.5}]});
  assert.match(invalid.error,/budget order/);
});


test('version 9 Sheets migrate Pin columns once without losing budgets or board locks',()=>{
  const api=backend(), entry={...blankEntry(),name:'Existing rent',budgetType:'expense',amount:1200,budgetOrder:2,budgetGroupOrder:1,boardItems:[{...newBoardItem('sticky'),pinned:true}]};
  assert.equal(api.call({action:'write',token:'one',revision:0,entries:[entry]}).ok,true);
  api.cells[0]=api.cells[0].slice(0,29);api.cells[1]=api.cells[1].slice(0,29);api.clearCache();
  const migrated=api.call({action:'read',token:'two'});
  assert.equal(migrated.ok,true,migrated.error);assert.deepEqual(migrated.entries,[entry]);
  assert.deepEqual(Array.from(api.cells[0].slice(29)),['pin','pinOrder']);
  assert.equal(api.cells[1][29],'false');assert.equal(api.cells[1][30],'-1');
  api.clearCache();assert.equal(api.call({action:'read',token:'one'}).revision,migrated.revision);
  const pinned={...entry,pin:true,pinOrder:0};
  const saved=api.call({action:'write',token:'one',revision:migrated.revision,entries:[pinned]});
  assert.equal(saved.ok,true,saved.error);api.clearCache();
  assert.deepEqual(api.call({action:'read',token:'two'}).entries,[pinned]);
  for(const patch of [{pin:'yes'},{pinOrder:-2},{pinOrder:0.5}])assert.match(api.call({action:'write',token:'one',revision:saved.revision,entries:[{...pinned,...patch}]}).error,/pin settings/);
  assert.equal(api.call({action:'write',token:'one',apiVersion:9,revision:saved.revision,entries:[]}).code,'UPGRADE_REQUIRED');
});
