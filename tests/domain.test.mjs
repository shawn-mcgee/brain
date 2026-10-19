import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankEntry,
  repeatDate,
  occurrences,
  validateEntry,
  sortTasks,
  nextTask,
  isDone,
  requirementDone,
  decodeEntries,
  periodRange,
  shiftPeriod,
  periodKind,
  todoOccurrences,
  occurrenceHighlight,
} from "../src/domain.ts";
const entry = (values = {}) => ({
  ...blankEntry(),
  note: "An entry",
  ...values,
});
test("monthly recurrence clamps without drifting from the anchor", () => {
  assert.equal(repeatDate("2024-01-31", "Monthly", 1), "2024-02-29");
  assert.equal(repeatDate("2024-01-31", "Monthly", 2), "2024-03-31");
  assert.equal(repeatDate("2024-02-29", "Annually", 1), "2025-02-28");
  assert.equal(repeatDate("2024-02-29", "Annually", 4), "2028-02-29");
  assert.equal(repeatDate("2025-08-31", "Semi-annually", 1), "2026-02-28");
  assert.equal(repeatDate("2025-01-31", "Quarterly", 1), "2025-04-30");
});
test("shared day, week and month boundaries handle leap years and year transitions", () => {
  assert.deepEqual(periodRange("Today", "2026-10-19"), {
    from: "2026-10-19",
    to: "2026-10-19",
  });
  assert.deepEqual(periodRange("This Week", "2026-10-19"), {
    from: "2026-10-18",
    to: "2026-10-24",
  });
  assert.deepEqual(periodRange("This Week", "2026-01-01"), {
    from: "2025-12-28",
    to: "2026-01-03",
  });
  assert.deepEqual(periodRange("This Week", "2026-10-18"), {
    from: "2026-10-18",
    to: "2026-10-24",
  });
  assert.deepEqual(periodRange("This Month", "2024-02-20"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.equal(shiftPeriod("Today", "2026-12-31", 1), "2027-01-01");
  assert.equal(shiftPeriod("This Week", "2026-01-01", -1), "2025-12-25");
  assert.equal(shiftPeriod("This Month", "2026-01-31", 1), "2026-02-01");
});
test("relative shortcuts resolve the previous and next day, full week, and full month", () => {
  const expected = {
    Yesterday: ["2026-10-18", "2026-10-18"],
    Tomorrow: ["2026-10-20", "2026-10-20"],
    "Last Week": ["2026-10-11", "2026-10-17"],
    "Next Week": ["2026-10-25", "2026-10-31"],
    "Last Month": ["2026-09-01", "2026-09-30"],
    "Next Month": ["2026-11-01", "2026-11-30"],
  };
  for (const [period, [from, to]] of Object.entries(expected))
    assert.deepEqual(periodRange(period, "2026-10-19"), { from, to });
  assert.deepEqual(periodRange("Yesterday", "2026-01-01"), {
    from: "2025-12-31",
    to: "2025-12-31",
  });
  assert.deepEqual(periodRange("Next Week", "2026-12-31"), {
    from: "2027-01-03",
    to: "2027-01-09",
  });
  assert.deepEqual(periodRange("Last Month", "2024-03-31"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(periodRange("Next Month", "2026-12-31"), {
    from: "2027-01-01",
    to: "2027-01-31",
  });
  assert.equal(periodKind("Yesterday"), "Today");
  assert.equal(periodKind("Next Week"), "This Week");
  assert.equal(periodKind("Last Month"), "This Month");
});
test("Todo shortcuts select matching occurrences and calendar navigation advances by the shortcut unit", () => {
  const recurring = entry({ beginsOn: "2026-01-01", repeat: "Daily" });
  assert.equal(
    todoOccurrences([recurring], "2026-10-19", "Yesterday")[0].date,
    "2026-10-18",
  );
  assert.equal(
    todoOccurrences([recurring], "2026-10-19", "Tomorrow")[0].date,
    "2026-10-20",
  );
  assert.equal(
    todoOccurrences([recurring], "2026-10-19", "Last Week").length,
    7,
  );
  assert.equal(
    todoOccurrences([recurring], "2026-10-19", "Next Month").length,
    30,
  );
  assert.deepEqual(
    periodRange("Next Week", shiftPeriod("Next Week", "2026-10-19", 1)),
    { from: "2026-11-01", to: "2026-11-07" },
  );
  assert.deepEqual(
    periodRange("Last Month", shiftPeriod("Last Month", "2026-10-19", -1)),
    { from: "2026-08-01", to: "2026-08-31" },
  );
});
test("Todo All contains tasks and upcoming or ongoing dates, excluding past events and plain notes", () => {
  const entries = [
    entry({ id: "task", task: true }),
    entry({ id: "overdue", task: true, endsOn: "2026-10-01" }),
    entry({ id: "start", beginsOn: "2026-10-20" }),
    entry({ id: "end", endsOn: "2026-10-21" }),
    entry({ id: "ongoing", beginsOn: "2026-10-10", endsOn: "2026-10-25" }),
    entry({ id: "past", endsOn: "2026-10-18" }),
    entry({ id: "note" }),
    entry({ id: "done", task: true, completed: true }),
  ];
  const ids = todoOccurrences(entries, "2026-10-19", "All").map(
    (o) => o.entry.id,
  );
  assert.deepEqual(
    new Set(ids),
    new Set(["task", "overdue", "start", "end", "ongoing"]),
  );
  assert.equal(
    todoOccurrences(entries, "2026-10-19", "All", true).some(
      (o) => o.entry.id === "done",
    ),
    true,
  );
});
test("Todo date filters include start-only, end-only and overlapping spans with inclusive boundaries", () => {
  const entries = [
    entry({ id: "start", beginsOn: "2026-10-19" }),
    entry({ id: "end", endsOn: "2026-10-19" }),
    entry({ id: "span", beginsOn: "2026-10-01", endsOn: "2026-11-01" }),
    entry({ id: "week", beginsOn: "2026-10-24" }),
    entry({ id: "month", beginsOn: "2026-10-31" }),
    entry({ id: "later", beginsOn: "2026-11-01" }),
    entry({ id: "undated", task: true }),
    entry({ id: "old-task", task: true, endsOn: "2026-10-17" }),
  ];
  const ids = (period) =>
    new Set(
      todoOccurrences(entries, "2026-10-19", period).map((o) => o.entry.id),
    );
  assert.deepEqual(ids("Today"), new Set(["start", "end", "span"]));
  assert.deepEqual(ids("This Week"), new Set(["start", "end", "span", "week"]));
  assert.deepEqual(
    ids("This Month"),
    new Set(["start", "end", "span", "week", "month", "old-task"]),
  );
});
test("Todo filtered recurrence expands each occurrence and filters completion individually", () => {
  const recurring = entry({
    task: true,
    endsOn: "2026-10-01",
    repeat: "Daily",
    completedDates: ["2026-10-19"],
  });
  assert.equal(todoOccurrences([recurring], "2026-10-19", "Today").length, 0);
  assert.equal(
    todoOccurrences([recurring], "2026-10-19", "Today", true).length,
    1,
  );
  assert.equal(
    todoOccurrences([recurring], "2026-10-19", "This Week").length,
    6,
  );
  const event = entry({ beginsOn: "2026-01-31", repeat: "Monthly" });
  assert.equal(
    todoOccurrences([event], "2026-02-10", "This Month")[0].date,
    "2026-02-28",
  );
  assert.equal(
    todoOccurrences([event], "2026-02-10", "All")[0].date,
    "2026-02-28",
  );
});
test("Todo preserves dependency ordering and highlights dated non-task entries", () => {
  const reference = entry({ id: "b", beginsOn: "2026-10-23" });
  const task = entry({
    id: "a",
    task: true,
    endsOn: "2026-10-19",
    requires: ["b"],
  });
  assert.deepEqual(
    todoOccurrences([task, reference], "2026-10-19", "This Week").map(
      (o) => o.entry.id,
    ),
    ["b", "a"],
  );
  const occurrence = (e) => todoOccurrences([e], "2026-10-19", "Today")[0];
  assert.equal(
    occurrenceHighlight(
      occurrence(entry({ beginsOn: "2026-10-19" })),
      "2026-10-19",
    ),
    "Starts today",
  );
  assert.equal(
    occurrenceHighlight(
      occurrence(entry({ endsOn: "2026-10-19" })),
      "2026-10-19",
    ),
    "Ends today",
  );
  assert.equal(
    occurrenceHighlight(
      occurrence(entry({ beginsOn: "2026-10-10", endsOn: "2026-10-25" })),
      "2026-10-19",
    ),
    "In progress",
  );
});
test("calendar includes overlapping spans and repeats at the original interval", () => {
  const e = entry({
    beginsOn: "2026-01-31",
    endsOn: "2026-02-02",
    repeat: "Monthly",
  });
  const result = occurrences(e, "2026-02-01", "2026-02-28");
  assert.deepEqual(
    result.map((x) => [x.start, x.end]),
    [
      ["2026-01-31", "2026-02-02"],
      ["2026-02-28", "2026-03-02"],
    ],
  );
});
test("dependencies precede dependent tasks even if their due date is later", () => {
  const a = entry({
    id: "a",
    task: true,
    endsOn: "2026-10-01",
    requires: ["b"],
  });
  const b = entry({ id: "b", task: true, endsOn: "2026-10-20" });
  assert.deepEqual(
    sortTasks([a, b], "2026-10-01").map((e) => e.id),
    ["b", "a"],
  );
  assert.match(validateEntry({ ...b, requires: ["a"] }, [a, b]), /cycle/);
});
test("recurring completion is per occurrence and leaves original anchor intact", () => {
  const e = entry({
    task: true,
    endsOn: "2026-01-31",
    repeat: "Monthly",
    completedDates: ["2026-01-31", "2026-02-28"],
  });
  assert.equal(nextTask(e, "2026-02-28").date, "2026-03-31");
  assert.equal(e.endsOn, "2026-01-31");
  assert.equal(isDone(e, "2026-02-28"), true);
  assert.equal(isDone(e, "2026-03-31"), false);
});
test("validation rejects missing dates, bad ranges and invalid budget links", () => {
  assert.match(validateEntry(entry({ beginsAt: "12:00" }), []), /date/);
  assert.match(validateEntry(entry({ repeat: "Weekly" }), []), /date/);
  assert.match(
    validateEntry(entry({ beginsOn: "2026-02-30" }), []),
    /valid date/,
  );
  assert.match(
    validateEntry(entry({ beginsOn: "2026-03-02", endsOn: "2026-03-01" }), []),
    /after/,
  );
  assert.match(
    validateEntry(
      entry({ transactionType: "expense", budgetId: "missing" }),
      [],
    ),
    /matching budget/,
  );
});
test("imports reject malformed data and preserve valid references", () => {
  assert.throws(() => decodeEntries([{ note: "Bad" }]), /invalid/);
  const plan = entry({ budgetType: "expense", amount: 100 });
  const actual = entry({
    transactionType: "expense",
    amount: 80,
    budgetId: plan.id,
  });
  assert.equal(decodeEntries([plan, actual]).length, 2);
  assert.throws(() => decodeEntries([plan, plan]), /duplicate/);
});
test("recurring prerequisite checks the relevant occurrence rather than the next unfinished one", () => {
  const e = entry({
    task: true,
    endsOn: "2026-01-01",
    repeat: "Monthly",
    completedDates: ["2026-01-01"],
  });
  assert.equal(requirementDone(e, "2026-01-20"), true);
  assert.equal(requirementDone(e, "2026-02-01"), false);
  assert.equal(requirementDone(entry({ task: false }), "2026-01-01"), true);
});
