import { test } from "node:test";
import assert from "node:assert/strict";
import { blankEntry } from "../src/domain.ts";
import { mergeEntries, synchronize, SyncConflict } from "../src/sync.ts";
const entry = (values = {}) => ({ ...blankEntry(), note: "A plan", ...values });
test("edits during a pending write rebase onto the acknowledged remote snapshot", () => {
  const sent = entry(),
    laterEdit = { ...sent, note: "Typed while syncing" };
  const acknowledged = { ...sent, endsOn: "2026-10-25" };
  const newRemote = entry({ note: "Added by spouse" });
  const result = mergeEntries([sent], [laterEdit], [acknowledged, newRemote]);
  assert.equal(result.entries[0].note, "Typed while syncing");
  assert.equal(result.entries[0].endsOn, "2026-10-25");
  assert.equal(result.entries.length, 2);
});
test("merge combines independent entry and field edits without mutating inputs", () => {
  const base = entry(),
    local = { ...base, note: "New title" },
    remote = { ...base, endsOn: "2026-10-22" };
  const extra = entry({ note: "Remote addition" });
  const result = mergeEntries([base], [local], [remote, extra]);
  assert.equal(result.conflicts, 0);
  assert.equal(result.entries[0].note, "New title");
  assert.equal(result.entries[0].endsOn, "2026-10-22");
  assert.equal(result.entries[1].id, extra.id);
  assert.equal(local.endsOn, "");
});
test("concurrent scalar edits preserve the other version as a separate entry", () => {
  const base = entry(),
    left = { ...base, note: "Left" },
    right = { ...base, note: "Right" };
  const result = mergeEntries([base], [left], [right]);
  assert.equal(result.conflicts, 1);
  assert.equal(result.entries.find((e) => e.id === base.id).note, "Left");
  assert.match(result.entries.find((e) => e.id !== base.id).note, /Right/);
});
test("deletions win against unchanged entries but concurrent edits survive", () => {
  const base = entry();
  assert.deepEqual(mergeEntries([base], [], [base]).entries, []);
  assert.deepEqual(mergeEntries([base], [base], []).entries, []);
  assert.equal(
    mergeEntries([base], [], [{ ...base, note: "Edited" }]).entries[0].note,
    "Edited",
  );
  assert.equal(
    mergeEntries([base], [{ ...base, note: "Edited" }], []).entries[0].note,
    "Edited",
  );
  assert.equal(mergeEntries(null, [], [base]).entries.length, 1);
});
test("set fields combine independent completions, additions and removals", () => {
  const base = entry({ who: ["Old"], completedDates: ["2026-10-01"] });
  const left = {
    ...base,
    who: ["Left"],
    completedDates: ["2026-10-01", "2026-10-02"],
  };
  const right = {
    ...base,
    who: ["Old", "Right"],
    completedDates: ["2026-10-01", "2026-10-03"],
  };
  const merged = mergeEntries([base], [left], [right]).entries[0];
  assert.deepEqual(merged.who, ["Left", "Right"]);
  assert.deepEqual(merged.completedDates, [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
  ]);
});
test("merge removes dangling references and breaks independently introduced cycles", () => {
  const a = entry({ id: "a" }),
    b = entry({ id: "b" });
  const cycle = mergeEntries(
    [a, b],
    [{ ...a, requires: ["b"] }, b],
    [a, { ...b, requires: ["a"] }],
  );
  assert.equal(cycle.conflicts, 1);
  assert.equal(
    cycle.entries.reduce((n, e) => n + e.requires.length, 0),
    1,
  );
  const dangling = mergeEntries([a, b], [a, b], [{ ...a, requires: [] }]);
  assert.equal(dangling.entries.length, 1);
});
test("coupled date edits preserve valid versions rather than sending invalid merged data", () => {
  const base = entry({ beginsOn: "2026-10-10", endsOn: "2026-10-20" });
  const result = mergeEntries(
    [base],
    [{ ...base, beginsOn: "2026-10-19" }],
    [{ ...base, endsOn: "2026-10-15" }],
  );
  assert.equal(result.entries.length, 2);
  assert.equal(result.conflicts, 1);
});
test("synchronization pulls and merges before retrying a stale revision", async () => {
  const base = entry(),
    local = { ...base, note: "Local" },
    remote = { ...base, endsOn: "2026-10-20" };
  let writes = 0,
    reads = 0;
  const result = await synchronize(
    { entries: [local], baseEntries: [base], revision: 1, dirty: true },
    async () => {
      reads++;
      return { entries: [remote], revision: 2 };
    },
    async (revision, entries) => {
      writes++;
      if (writes === 1) throw new SyncConflict("stale");
      assert.equal(revision, 2);
      assert.equal(entries[0].note, "Local");
      assert.equal(entries[0].endsOn, "2026-10-20");
      return { entries, revision: 3 };
    },
  );
  assert.equal(result.revision, 3);
  assert.equal(writes, 2);
  assert.equal(reads, 1);
});
test("first sync merges local-only data with the existing Sheet and clean sync only reads", async () => {
  const local = entry(),
    remote = entry();
  const result = await synchronize(
    { entries: [local], baseEntries: null, revision: null, dirty: true },
    async () => ({ entries: [remote], revision: 7 }),
    async (revision, entries) => {
      assert.equal(revision, 7);
      return { entries, revision: 8 };
    },
  );
  assert.equal(result.entries.length, 2);
  await synchronize(
    { entries: [], baseEntries: [], revision: 8, dirty: false },
    async () => ({ entries: [remote], revision: 9 }),
    async () => {
      throw new Error("must not write");
    },
  );
});
test("network failures do not trigger blind merge retries, and repeated conflicts are bounded", async () => {
  const state = { entries: [], baseEntries: [], revision: 1, dirty: true };
  let reads = 0;
  await assert.rejects(
    () =>
      synchronize(
        state,
        async () => {
          reads++;
          return { entries: [], revision: 1 };
        },
        async () => {
          throw new Error("offline");
        },
      ),
    /offline/,
  );
  assert.equal(reads, 0);
  await assert.rejects(
    () =>
      synchronize(
        state,
        async () => {
          reads++;
          return { entries: [], revision: 2 };
        },
        async () => {
          throw new SyncConflict();
        },
      ),
    /changing frequently/,
  );
  assert.equal(reads, 5);
});
