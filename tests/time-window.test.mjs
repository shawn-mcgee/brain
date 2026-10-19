import { test } from "node:test";
import assert from "node:assert/strict";
import {
  windowParts,
  windowValue,
  changeWindowScope,
} from "../src/time-window.ts";
test("everything expands to week by default for this, last, or next", () => {
  assert.deepEqual(windowParts("All"), { scope: "everything", unit: null });
  assert.equal(changeWindowScope("All", "this"), "This Week");
  assert.equal(changeWindowScope("All", "last"), "Last Week");
  assert.equal(changeWindowScope("All", "next"), "Next Week");
});
test("day selection collapses to today, yesterday, or tomorrow", () => {
  assert.equal(windowValue("this", "day"), "Today");
  assert.equal(windowValue("last", "day"), "Yesterday");
  assert.equal(windowValue("next", "day"), "Tomorrow");
  assert.equal(changeWindowScope("Yesterday", "next"), "Next Week");
});
test("switching relative scope preserves month and everything removes the unit", () => {
  assert.equal(changeWindowScope("This Month", "last"), "Last Month");
  assert.equal(changeWindowScope("Last Month", "next"), "Next Month");
  assert.equal(changeWindowScope("Next Month", "everything"), "All");
  for (const value of [
    "All",
    "Today",
    "Yesterday",
    "Tomorrow",
    "This Week",
    "Last Week",
    "Next Week",
    "This Month",
    "Last Month",
    "Next Month",
  ]) {
    const { scope, unit } = windowParts(value);
    assert.equal(windowValue(scope, unit || undefined), value);
  }
});
