import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { blankEntry } from "../src/domain.ts";
const source = fs.readFileSync(
  new URL("../apps-script/Code.gs", import.meta.url),
  "utf8",
);
function backend() {
  const properties = new Map([
    ["SPREADSHEET_ID", "test-sheet"],
    ["ALLOWED_EMAILS", "one@gmail.com, TWO@gmail.com"],
  ]);
  const cells = [];
  let sheet = null,
    reads = 0;
  const instance = {
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
  };
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
      getScriptLock: () => ({
        tryLock: () => true,
        hasLock: () => true,
        releaseLock: () => {},
      }),
    },
    SpreadsheetApp: {
      openById: () => {
        reads++;
        return {
          getSheetByName: () => sheet,
          insertSheet: () => (sheet = instance),
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
      context.doPost({ postData: { contents: JSON.stringify(body) } }),
    );
  return { call, cells, reads: () => reads };
}
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
    e = { ...blankEntry(), note: '=IMPORTXML("https://example.com")' };
  assert.equal(api.call({ action: "read", token: "one" }).revision, 0);
  const saved = api.call({
    action: "write",
    token: "one",
    revision: 0,
    entries: [e],
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.revision, 1);
  assert.equal(api.cells[1][1].startsWith('"'), true);
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
    e = { ...blankEntry(), note: "A task", requires: ["missing"] };
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
