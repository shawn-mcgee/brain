import { test } from "node:test";
import assert from "node:assert/strict";
import { blankEntry, validateEntry } from "../src/domain.ts";
import {
  initialEntrySections,
  availableEntrySections,
  removeEntrySection,
} from "../src/entry-sections.ts";
test('notes are optional removable enhancements that leave the name intact',()=>{
  const entry={...blankEntry(),name:'Shopping',note:'Milk and eggs'};
  assert.ok(initialEntrySections(entry).includes('note'));
  const removed=removeEntrySection(entry,['note'],'note');
  assert.equal(removed.entry.name,'Shopping');
  assert.equal(removed.entry.note,'');
  assert.equal(validateEntry(removed.entry,[removed.entry]),'');
  assert.ok(availableEntrySections(removed.sections).includes('note'));
});
test("repeat availability follows attached time sections, including empty ones", () => {
  assert.equal(availableEntrySections([]).includes("repeat"), false);
  assert.equal(availableEntrySections(["begins"]).includes("repeat"), true);
  assert.equal(availableEntrySections(["ends"]).includes("repeat"), true);
  assert.equal(
    availableEntrySections(["begins", "repeat"]).includes("repeat"),
    false,
  );
  const entry = { ...blankEntry(), name: "Plan", repeat: "Weekly" };
  assert.match(validateEntry(entry, []), /date/);
});
test("removing one time section retains the other and repetition", () => {
  const entry = {
    ...blankEntry(),
    name: "Trip",
    beginsOn: "2026-10-19",
    beginsAt: "09:00",
    endsOn: "2026-10-20",
    endsAt: "10:00",
    repeat: "Weekly",
    completedDates: ["2026-10-19"],
  };
  const result = removeEntrySection(
    entry,
    ["begins", "ends", "repeat"],
    "begins",
  );
  assert.deepEqual(result.sections, ["ends", "repeat"]);
  assert.equal(result.entry.beginsOn, "");
  assert.equal(result.entry.beginsAt, "");
  assert.equal(result.entry.endsOn, "2026-10-20");
  assert.equal(result.entry.endsAt, "10:00");
  assert.equal(result.entry.repeat, "Weekly");
  assert.equal(entry.beginsOn, "2026-10-19");
});
test("removing the final time section removes and clears repeat state", () => {
  for (const section of ["begins", "ends"]) {
    const entry = {
      ...blankEntry(),
      name: "Plan",
      beginsOn: section === "begins" ? "2026-10-19" : "",
      endsOn: section === "ends" ? "2026-10-19" : "",
      repeat: "Daily",
      completedDates: ["2026-10-19"],
    };
    const result = removeEntrySection(
      entry,
      ["who", section, "repeat"],
      section,
    );
    assert.deepEqual(result.sections, ["who"]);
    assert.equal(result.entry.repeat, "");
    assert.deepEqual(result.entry.completedDates, []);
    assert.equal(
      availableEntrySections(result.sections).includes("repeat"),
      false,
    );
  }
});
test("editing existing dated entries restores individual sections and removing repeat keeps dates", () => {
  const entry = {
    ...blankEntry(),
    endsOn: "2026-10-19",
    endsAt: "09:30",
    repeat: "Monthly",
  };
  assert.deepEqual(initialEntrySections(entry), ["ends", "repeat"]);
  const result = removeEntrySection(entry, ["ends", "repeat"], "repeat");
  assert.deepEqual(result.sections, ["ends"]);
  assert.equal(result.entry.endsOn, "2026-10-19");
  assert.equal(result.entry.endsAt, "09:30");
  assert.equal(
    availableEntrySections(result.sections).includes("repeat"),
    true,
  );
});
