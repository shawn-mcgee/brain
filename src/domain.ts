import { validateBoardFields } from './board-model.ts';
import type { BoardItem, Attachment } from './board-model.ts';
export const intervals = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Semi-annually",
  "Annually",
] as const;
export type Interval = (typeof intervals)[number];
export type Entry = {
  id: string;
  name: string;
  note: string;
  who: string[];
  task: boolean;
  completed: boolean;
  completedDates: string[];
  requires: string[];
  beginsOn: string;
  beginsAt: string;
  endsOn: string;
  endsAt: string;
  repeat: Interval | "";
  budgetType: "" | "income" | "expense";
  transactionType: "" | "income" | "expense";
  amount: number;
  budgetId: string;
  createdAt: string;
  updatedAt: string;
  boardItems: BoardItem[];
  attachments: Attachment[];
};
export type Occurrence = {
  entry: Entry;
  date: string;
  start: string;
  end: string;
  key: string;
};
export function blankEntry(): Entry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    note: "",
    name: "",
    who: [],
    task: false,
    completed: false,
    completedDates: [],
    requires: [],
    beginsOn: "",
    beginsAt: "",
    endsOn: "",
    endsAt: "",
    repeat: "",
    budgetType: "",
    transactionType: "",
    amount: 0,
    budgetId: "",
    createdAt: now,
    updatedAt: now,
    boardItems: [],
    attachments: [],
  };
}
export const periods = [
  "Yesterday",
  "Today",
  "Tomorrow",
  "Last Week",
  "This Week",
  "Next Week",
  "Last Month",
  "This Month",
  "Next Month",
] as const;
export type Period = (typeof periods)[number];
export function periodKind(
  period: Period,
): "Today" | "This Week" | "This Month" {
  return period.includes("Week")
    ? "This Week"
    : period.includes("Month")
      ? "This Month"
      : "Today";
}
export function periodRange(
  period: Period,
  anchor: string,
): { from: string; to: string } {
  const kind = periodKind(period);
  const offset = ["Yesterday", "Last Week", "Last Month"].includes(period)
    ? -1
    : ["Tomorrow", "Next Week", "Next Month"].includes(period)
      ? 1
      : 0;
  anchor = shiftPeriod(kind, anchor, offset);
  const date = parseDate(anchor);
  if (kind === "Today") return { from: anchor, to: anchor };
  if (kind === "This Week") {
    const from = addDays(anchor, -date.getDay());
    return { from, to: addDays(from, 6) };
  }
  return {
    from: dateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}
export function shiftPeriod(
  period: Period,
  anchor: string,
  direction: number,
): string {
  const kind = periodKind(period);
  if (kind !== "This Month")
    return addDays(anchor, direction * (kind === "Today" ? 1 : 7));
  const date = parseDate(anchor);
  return dateKey(new Date(date.getFullYear(), date.getMonth() + direction, 1));
}
function nextScheduled(e: Entry, today: string): Occurrence | undefined {
  const anchor = e.beginsOn || e.endsOn;
  if (!anchor) return;
  const duration =
    e.beginsOn && e.endsOn ? daysBetween(e.beginsOn, e.endsOn) : 0;
  for (let i = 0; i < 120000; i++) {
    const date = e.repeat ? repeatDate(anchor, e.repeat, i) : anchor;
    if (date > "2200-12-31") return;
    const end = addDays(date, duration);
    if (end >= today)
      return { entry: e, date, start: date, end, key: `${e.id}:${date}` };
    if (!e.repeat) return;
  }
}
export function todoOccurrences(
  entries: Entry[],
  today: string,
  period: Period | "All",
  showDone = false,
): Occurrence[] {
  const range = period === "All" ? null : periodRange(period, today);
  const candidates = entries
    .flatMap((e) => {
      if (range) return occurrences(e, range.from, range.to);
      if (e.task) {
        const next = nextTask(e, today);
        if (!showDone || !e.repeat) return [next];
        const duration =
          e.beginsOn && e.endsOn ? daysBetween(e.beginsOn, e.endsOn) : 0;
        const completed = [...new Set(e.completedDates)].map((date) => ({
          entry: e,
          date,
          start: date,
          end: addDays(date, duration),
          key: `${e.id}:${date}`,
        }));
        return [...completed, next];
      }
      const next = nextScheduled(e, today);
      return next ? [next] : [];
    })
    .filter((o) => showDone || !o.entry.task || !isDone(o.entry, o.date))
    .sort(
      (a, b) =>
        (a.end || a.start || "9999").localeCompare(
          b.end || b.start || "9999",
        ) ||
        (a.entry.endsAt || a.entry.beginsAt).localeCompare(
          b.entry.endsAt || b.entry.beginsAt,
        ) ||
        a.entry.name.localeCompare(b.entry.name),
    );
  const ordered: Occurrence[] = [],
    seen = new Set<string>();
  function visit(o: Occurrence) {
    if (seen.has(o.key)) return;
    seen.add(o.key);
    o.entry.requires.forEach((id) => {
      const matches = candidates.filter((x) => x.entry.id === id);
      const required =
        matches.filter((x) => x.date <= o.date).at(-1) || matches[0];
      if (required) visit(required);
    });
    ordered.push(o);
  }
  candidates.forEach(visit);
  return ordered;
}
export function occurrenceHighlight(o: Occurrence, today: string): string {
  if (!o.start && !o.end) return "";
  if (o.start < today && o.end >= today)
    return o.end === today ? "Ends today" : "In progress";
  if (o.start === today)
    return o.entry.beginsOn
      ? "Starts today"
      : o.entry.task
        ? "Due today"
        : "Ends today";
  if (o.end < today) return o.entry.task ? "" : "Past";
  return o.entry.task ? "" : "Coming up";
}
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(s: string): Date {
  return new Date(`${s}T12:00:00`);
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function daysBetween(a: string, b: string): number {
  const utc = (s: string) => {
    const d = parseDate(s);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((utc(b) - utc(a)) / 86400000);
}
export function repeatDate(
  anchor: string,
  interval: Interval,
  index: number,
): string {
  if (interval === "Daily" || interval === "Weekly")
    return addDays(anchor, index * (interval === "Daily" ? 1 : 7));
  const step = { Monthly: 1, Quarterly: 3, "Semi-annually": 6, Annually: 12 }[
    interval
  ];
  const d = parseDate(anchor),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + step * index);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dateKey(d);
}
export function occurrences(
  entry: Entry,
  from: string,
  to: string,
): Occurrence[] {
  const anchor = entry.beginsOn || entry.endsOn;
  if (!anchor) return [];
  const duration =
    entry.beginsOn && entry.endsOn
      ? daysBetween(entry.beginsOn, entry.endsOn)
      : 0;
  const out: Occurrence[] = [];
  for (let i = 0; i < 120000; i++) {
    const start = entry.repeat ? repeatDate(anchor, entry.repeat, i) : anchor;
    if (start > to) break;
    const end = addDays(start, duration);
    if (end >= from)
      out.push({ entry, date: start, start, end, key: `${entry.id}:${start}` });
    if (!entry.repeat) break;
  }
  return out;
}
export function isDone(e: Entry, date?: string): boolean {
  return e.repeat ? !!date && e.completedDates.includes(date) : e.completed;
}
export function requirementDone(e: Entry, date: string): boolean {
  if (!e.task) return true;
  if (!e.repeat) return e.completed;
  const anchor = e.beginsOn || e.endsOn;
  const relevant = occurrences(e, anchor, date).at(-1);
  return !!relevant && isDone(e, relevant.date);
}
export function nextTask(e: Entry, today: string): Occurrence {
  const anchor = e.beginsOn || e.endsOn;
  if (e.repeat && anchor) {
    for (let i = 0; i < 120000; i++) {
      const date = repeatDate(anchor, e.repeat, i);
      if (!e.completedDates.includes(date))
        return {
          entry: e,
          date,
          start: date,
          end: addDays(
            date,
            e.beginsOn && e.endsOn ? daysBetween(e.beginsOn, e.endsOn) : 0,
          ),
          key: `${e.id}:${date}`,
        };
    }
  }
  return {
    entry: e,
    date: anchor || today,
    start: e.beginsOn,
    end: e.endsOn,
    key: e.id,
  };
}
export function sortTasks(entries: Entry[], today: string): Entry[] {
  const ordered = entries
    .filter((e) => e.task)
    .sort((a, b) => {
      const x = nextTask(a, today),
        y = nextTask(b, today);
      return (x.end || x.start || "9999").localeCompare(
        y.end || y.start || "9999",
      );
    });
  const result: Entry[] = [],
    seen = new Set<string>();
  function visit(e: Entry) {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    e.requires.forEach((id) => {
      const dep = entries.find((x) => x.id === id);
      if (dep?.task) visit(dep);
    });
    result.push(e);
  }
  ordered.forEach(visit);
  return result;
}
export function validateEntry(e: Entry, entries: Entry[]): string {
  const boardError = validateBoardFields(e.boardItems || [], e.attachments || []);
  if (boardError) return boardError;
  if (!e.name.trim()) return "Give this entry a name.";
  if (e.name.length > 10000) return "Keep names under 10,000 characters.";
  if (e.note.length > 10000) return "Keep notes under 10,000 characters.";
  if ((e.beginsAt && !e.beginsOn) || (e.endsAt && !e.endsOn))
    return "Add a date before adding a time.";
  for (const d of [e.beginsOn, e.endsOn].filter(Boolean)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      d < "1900-01-01" ||
      d > "2200-12-31" ||
      dateKey(parseDate(d)) !== d
    )
      return "Choose a valid date between 1900 and 2200.";
  }
  if (
    e.endsOn &&
    e.beginsOn &&
    (e.endsOn < e.beginsOn ||
      (e.endsOn === e.beginsOn &&
        e.beginsAt &&
        e.endsAt &&
        e.endsAt < e.beginsAt))
  )
    return "The end must come after the beginning.";
  if (e.repeat && !e.beginsOn && !e.endsOn)
    return "Repeating entries need a beginning or ending date.";
  if (e.repeat && !intervals.includes(e.repeat))
    return "Choose a valid repeat interval.";
  if (!Number.isFinite(e.amount) || e.amount < 0)
    return "Enter a positive amount or zero.";
  if (e.budgetType && e.transactionType)
    return "Use separate entries for a budget plan and an actual transaction.";
  if (
    e.budgetId &&
    !entries.some(
      (x) =>
        x.id === e.budgetId &&
        x.budgetType === e.transactionType &&
        x.id !== e.id,
    )
  )
    return "Link the transaction to a matching budget item.";
  const visited = new Set<string>();
  function cycle(id: string): boolean {
    if (id === e.id) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    return !!entries.find((x) => x.id === id)?.requires.some(cycle);
  }
  if (e.requires.some((id) => !entries.some((x) => x.id === id)))
    return "A required entry no longer exists.";
  if (e.requires.some(cycle))
    return "Requirements cannot create a dependency cycle.";
  return "";
}
export function decodeEntries(value: unknown): Entry[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error("Expected an array of up to 10,000 entries.");
  const normalized = value.map(raw => {
    if(!raw || typeof raw!=='object')return raw;
    const legacy=raw.name===undefined && typeof raw.note==='string';
    const lines=legacy?raw.note.trim().split(/\r?\n/):[];
    return {...raw,...(legacy?{name:lines[0],note:lines.slice(1).join('\n')}:{}),boardItems:raw.boardItems ?? [],attachments:raw.attachments ?? []};
  });
  const strings = [
    "name",
    "id",
    "note",
    "beginsOn",
    "beginsAt",
    "endsOn",
    "endsAt",
    "repeat",
    "budgetType",
    "transactionType",
    "budgetId",
    "createdAt",
    "updatedAt",
  ];
  const ids = new Set<string>();
  for (const raw of normalized) {
    if (
      !raw ||
      typeof raw !== "object" ||
      strings.some((k) => typeof raw[k] !== "string") ||
      ["who", "requires", "completedDates"].some(
        (k) =>
          !Array.isArray(raw[k]) ||
          !raw[k].every((x: unknown) => typeof x === "string"),
      ) ||
      typeof raw.task !== "boolean" ||
      typeof raw.completed !== "boolean" ||
      typeof raw.amount !== "number" ||
      !raw.id ||
      ids.has(raw.id)
    )
      throw new Error("This file contains invalid or duplicate entries.");
    if (
      !["", "income", "expense"].includes(raw.budgetType) ||
      !["", "income", "expense"].includes(raw.transactionType)
    )
      throw new Error("Invalid financial type.");
    if (
      [raw.beginsAt, raw.endsAt].some(
        (t) => t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t),
      )
    )
      throw new Error("Invalid time.");
    ids.add(raw.id);
  }
  for (const e of normalized as Entry[]) {
    const error = validateEntry(e, normalized);
    if (error) throw new Error(error);
  }
  return normalized as Entry[];
}
