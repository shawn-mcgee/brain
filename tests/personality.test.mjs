import { test } from "node:test";
import assert from "node:assert/strict";
import { blankEntry } from "../src/domain.ts";
import { taskTheme, taskParticles, taskCompletionKind, taskCompletionGlyph } from "../src/personality.ts";
const entry = (note, extra = {}) => ({ ...blankEntry(), name:note, ...extra });
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


test('completion priority is money, then checklist, then plain task regardless of name',()=>{
  const list=[{id:'line',text:'First',completed:false,completedDates:[]}];
  const plain=entry('Clean',{task:true}),checklist=entry('Pay bills',{task:true,list}),money={...checklist,budgetType:'expense'};
  assert.equal(taskCompletionKind(plain),'plain');assert.equal(taskCompletionGlyph(plain),'\u2705');
  assert.equal(taskCompletionKind(checklist),'list');assert.equal(taskCompletionGlyph(checklist),'\u{1F4AF}');assert.equal(taskTheme(checklist),'list');
  const particles=taskParticles(checklist,()=>0);
  assert.ok(particles.every(p=>p.glyph==='\u{1F4AF}'));
  for(const financial of [money,{...checklist,transactionType:'income'}]){
    assert.equal(taskCompletionKind(financial),'money');assert.equal(taskCompletionGlyph(financial),'\u{1F4B0}');assert.equal(taskTheme(financial),'money');
  }
});
