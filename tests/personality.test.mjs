import { test } from "node:test";
import assert from "node:assert/strict";
import { blankEntry } from "../src/domain.ts";
import { taskTheme, taskParticles } from "../src/personality.ts";
const entry = (note, extra = {}) => ({ ...blankEntry(), note, ...extra });
test("completion particles use the task subject, including financial attributes", () => {
  for (const [note, theme] of [
    ["Pay electricity bill", "money"],
    ["Do the laundry", "chores"],
    ["Buy groceries", "food"],
    ["Water the garden", "garden"],
    ["Walk the dog", "pets"],
    ["Go to the gym", "exercise"],
    ["Finish homework", "study"],
    ["Call Alex", "general"],
  ])
    assert.equal(taskTheme(entry(note)), theme);
  assert.equal(
    taskTheme(entry("Monthly plan", { budgetType: "expense" })),
    "money",
  );
  assert.equal(
    taskTheme(entry("Payment", { transactionType: "income" })),
    "money",
  );
});
test("particle bursts are bounded, randomizable, and use relevant glyphs", () => {
  const particles = taskParticles(entry("Clean the kitchen"), () => 0.5);
  assert.equal(particles.length, 12);
  assert.ok(particles.every((p) => ["🧹", "🫧", "🧽", "✨"].includes(p.glyph)));
  assert.ok(
    particles.every(
      (p) =>
        p.x >= -110 &&
        p.x <= 110 &&
        p.y >= -160 &&
        p.y <= -50 &&
        p.delay >= 0 &&
        p.delay <= 120,
    ),
  );
  assert.notDeepEqual(
    taskParticles(entry("Pay rent"), () => 0.1),
    taskParticles(entry("Pay rent"), () => 0.9),
  );
});
