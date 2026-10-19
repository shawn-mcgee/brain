import type { Entry } from "./domain.ts";
export const sectionNames = {
  task: "Task",
  who: "Who",
  begins: "Begins",
  ends: "Ends/Due",
  repeat: "Repeats",
  requires: "Requires",
  money: "Money",
} as const;
export type EntrySection = keyof typeof sectionNames;
export const sectionEmoji: Record<EntrySection, string> = {
  task: "✅",
  who: "👥",
  begins: "🌅",
  ends: "🏁",
  repeat: "🔁",
  requires: "🔗",
  money: "💰",
};
export function initialEntrySections(entry: Entry): EntrySection[] {
  const sections: EntrySection[] = [];
  if (entry.task) sections.push("task");
  if (entry.who.length) sections.push("who");
  if (entry.beginsOn || entry.beginsAt) sections.push("begins");
  if (entry.endsOn || entry.endsAt) sections.push("ends");
  if (entry.repeat) sections.push("repeat");
  if (entry.requires.length) sections.push("requires");
  if (entry.budgetType || entry.transactionType) sections.push("money");
  return sections;
}
export function availableEntrySections(
  sections: EntrySection[],
): EntrySection[] {
  return (Object.keys(sectionNames) as EntrySection[]).filter(
    (section) =>
      !sections.includes(section) &&
      (section !== "repeat" ||
        sections.includes("begins") ||
        sections.includes("ends")),
  );
}
export function removeEntrySection(
  entry: Entry,
  sections: EntrySection[],
  section: EntrySection,
): { entry: Entry; sections: EntrySection[] } {
  const cleared: Record<EntrySection, Partial<Entry>> = {
    task: { task: false, completed: false, completedDates: [] },
    who: { who: [] },
    begins: { beginsOn: "", beginsAt: "" },
    ends: { endsOn: "", endsAt: "" },
    repeat: { repeat: "", completedDates: [] },
    requires: { requires: [] },
    money: { budgetType: "", transactionType: "", amount: 0, budgetId: "" },
  };
  let remaining = sections.filter((value) => value !== section);
  const updated = { ...entry, ...cleared[section] };
  if (!remaining.includes("begins") && !remaining.includes("ends")) {
    remaining = remaining.filter((value) => value !== "repeat");
    updated.repeat = "";
    updated.completedDates = [];
  }
  return { entry: updated, sections: remaining };
}
