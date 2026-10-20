import {dateKey} from './domain.ts';
import type { Entry } from "./domain.ts";
import {reconcileList} from './checklist-model.ts';
export const sectionNames = {
  note: 'Note',
  task: "Task",
  list: 'List',
  who: "Who",
  where: 'Where',
  color: 'Color',
  tags: 'Tags',
  group: 'Group',
  when: "When",
  repeat: "Repeats",
  requires: "Waiting on",
  money: "Money",
  attachments: 'Files',
} as const;
export type EntrySection = keyof typeof sectionNames;
export const sectionEmoji: Record<EntrySection, string> = {
  note: '📝',
  task: "✅",
  list: '☑️',
  who: "👥",
  where: '📍',
  color: '🎨',
  tags: '🏷️',
  group: '\u{1F4C1}',
  when: "\u{1F552}",
  repeat: "🔁",
  requires: "🔗",
  money: "💰",
  attachments: '📎',
};
export function initialEntrySections(entry: Entry): EntrySection[] {
  const sections: EntrySection[] = [];
  if(entry.note)sections.push('note');
  if (entry.task) sections.push("task");
  if (entry.list.length) sections.push('list');
  if (entry.who.length) sections.push("who");
  if(entry.where)sections.push('where');
  if(entry.color)sections.push('color');
  if(entry.tags.length)sections.push('tags');
  if(entry.group)sections.push('group');
  if (entry.beginsOn || entry.endsOn) sections.push("when");
  if (entry.repeat) sections.push("repeat");
  if (entry.requires.length) sections.push("requires");
  if (entry.budgetType || entry.transactionType) sections.push("money");
  if (entry.attachments?.length || entry.boardItems?.some(item=>item.kind==='polaroid')) sections.push('attachments');
  return sectionOrder.filter(section=>sections.includes(section));
}
export function availableEntrySections(
  sections: EntrySection[],
): EntrySection[] {
  return sectionOrder.filter(
    (section) =>
      !sections.includes(section) &&
      (section !== "requires" || sections.includes("task")) &&
      (section !== "repeat" ||
        sections.includes("when")),
  );
}
export function removeEntrySection(
  entry: Entry,
  sections: EntrySection[],
  section: EntrySection,
): { entry: Entry; sections: EntrySection[] } {
  const cleared: Record<EntrySection, Partial<Entry>> = {
    note: {note:''},
    task: { task: false, completed: false, completedDates: [], requires: [] },
    list: {list:[]},
    who: { who: [] },
    where: {where:''},
    color: {color:''},
    tags: {tags:[]},
    group: {group:''},
    when: { beginsOn: "", beginsAt: "", endsOn: "", endsAt: "" },
    repeat: { repeat: "", repeatUntil:"", completedDates: [], list:entry.list.map(line=>({...line,completedDates:[]})) },
    requires: { requires: [] },
    money: { budgetType: "", transactionType: "", amount: 0, budgetId: "" },
    attachments: {attachments:[]},
  };
  let remaining = sections.filter((value) => value !== section);
  const updated = { ...entry, ...cleared[section] };
  if(section==='task')remaining=remaining.filter(value=>value!=='requires');
  if (!remaining.includes("when")) {
    remaining = remaining.filter((value) => value !== "repeat");
    updated.repeat = "";
    updated.repeatUntil = "";
    updated.completedDates = [];
    updated.list = updated.list.map(line=>({...line,completedDates:[]}));
  }
  return { entry: updated, sections: remaining };
}
export function initializeEntrySection(entry:Entry,section:EntrySection):Entry {
  if(section==='when'){const date=entry.beginsOn||entry.endsOn||dateKey(new Date());const time=entry.beginsAt||entry.endsAt;return {...entry,beginsOn:date,endsOn:entry.endsOn||date,beginsAt:time,endsAt:entry.endsAt||time};}
  if(section==='money'&&!entry.budgetType&&!entry.transactionType)return {...entry,budgetType:'income'};
  if(section==='task')return reconcileList({...entry,task:true});
  return entry;
}
export const sectionDescriptions:Record<EntrySection,string>={
  note:'Extra details shown in the card body or photo caption.',
  task:'This thought can be marked complete.',
  list:'A checklist. Completing every line completes the task; toggling the task checks or unchecks every line.',
  who:'People associated with this thought. Separate names with commas.',
  where:'A place or location associated with this thought.',
  color:'The color of this thought in lists, calendars, and on the board.',
  tags:'Searchable labels. Separate tags with commas.',
  group:'One group name; cards in the same group move together on the board.',
  when:'A single date or a range. Tasks are due by the end. Time is optional.',
  repeat:'How often the dated thought repeats.',
  requires:'Thoughts this thought is waiting on. Select as many as needed.',
  money:'A budget plan or an actual income or expense.',
  attachments:'Files attached to this thought, loaded when needed.',
};

export const sectionOrder:EntrySection[]=['note','task','requires','list','who','when','repeat','where','money','attachments','color','group','tags'];
