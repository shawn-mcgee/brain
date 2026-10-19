import type { Entry } from "./domain.ts";
export const sectionNames = {
  note: 'Note',
  task: "Task",
  who: "Who",
  where: 'Where',
  color: 'Color',
  tags: 'Tags',
  group: 'Group',
  begins: "Begins",
  ends: "Ends/Due",
  repeat: "Repeats",
  requires: "Requires",
  money: "Money",
  attachments: 'Files',
} as const;
export type EntrySection = keyof typeof sectionNames;
export const sectionEmoji: Record<EntrySection, string> = {
  note: '📝',
  task: "✅",
  who: "👥",
  where: '📍',
  color: '🎨',
  tags: '🏷️',
  group: '\u{1F4C1}',
  begins: "\u{1F552}",
  ends: "🏁",
  repeat: "🔁",
  requires: "🔗",
  money: "💰",
  attachments: '📎',
};
export function initialEntrySections(entry: Entry): EntrySection[] {
  const sections: EntrySection[] = [];
  if(entry.note)sections.push('note');
  if (entry.task) sections.push("task");
  if (entry.who.length) sections.push("who");
  if(entry.where)sections.push('where');
  if(entry.color)sections.push('color');
  if(entry.tags.length)sections.push('tags');
  if(entry.group)sections.push('group');
  if (entry.beginsOn || entry.beginsAt) sections.push("begins");
  if (entry.endsOn || entry.endsAt) sections.push("ends");
  if (entry.repeat) sections.push("repeat");
  if (entry.requires.length) sections.push("requires");
  if (entry.budgetType || entry.transactionType) sections.push("money");
  if (entry.attachments?.length || entry.boardItems?.some(item=>item.kind==='polaroid')) sections.push('attachments');
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
    note: {note:''},
    task: { task: false, completed: false, completedDates: [] },
    who: { who: [] },
    where: {where:''},
    color: {color:''},
    tags: {tags:[]},
    group: {group:''},
    begins: { beginsOn: "", beginsAt: "" },
    ends: { endsOn: "", endsAt: "" },
    repeat: { repeat: "", completedDates: [] },
    requires: { requires: [] },
    money: { budgetType: "", transactionType: "", amount: 0, budgetId: "" },
    attachments: {attachments:[]},
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
export function initializeEntrySection(entry:Entry,section:EntrySection):Entry {
  if(section==='begins')return {...entry,beginsOn:entry.endsOn,beginsAt:entry.endsAt};
  if(section==='ends')return {...entry,endsOn:entry.beginsOn,endsAt:entry.beginsAt};
  if(section==='task')return {...entry,task:true};
  return entry;
}
export const sectionDescriptions:Record<EntrySection,string>={
  note:'Extra details shown in the card body or photo caption.',
  task:'This item can be marked complete.',
  who:'People associated with this entry. Separate names with commas.',
  where:'A place or location associated with this entry.',
  color:'The paper color used for this entry on the board.',
  tags:'Searchable labels. Separate tags with commas.',
  group:'One group name; cards in the same group move together on the board.',
  begins:'When this entry starts. Time is optional.',
  ends:'When this entry ends or is due. Time is optional.',
  repeat:'How often the dated entry repeats.',
  requires:'Entries that must be complete before this task can be completed.',
  money:'A budget plan or an actual income or expense.',
  attachments:'Files attached to this entry, loaded when needed.',
};
