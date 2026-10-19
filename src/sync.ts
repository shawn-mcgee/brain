import { decodeEntries } from "./domain.ts";
import type { Entry } from "./domain.ts";
import { mergeItems } from './board-model.ts';
import type { BoardItem } from './board-model.ts';
import {reconcileList} from './checklist-model.ts';
export class SyncConflict extends Error {}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function mergeEntries(
  base: Entry[] | null,
  local: Entry[],
  remote: Entry[],
): { entries: Entry[]; conflicts: number } {
  const before = new Map((base || []).map((e) => [e.id, e]));
  const ours = new Map(local.map((e) => [e.id, e]));
  const theirs = new Map(remote.map((e) => [e.id, e]));
  const entries: Entry[] = [];
  let conflicts = 0;
  for (const id of new Set([
    ...before.keys(),
    ...ours.keys(),
    ...theirs.keys(),
  ])) {
    const b = before.get(id),
      l = ours.get(id),
      r = theirs.get(id);
    if (!l || !r) {
      const existing = l || r;
      // A deletion wins against an unchanged entry; an actual edit survives deletion.
      // With no baseline (older browser caches), never infer a deletion.
      if (existing && (!b || !same(existing, b)))
        entries.push(structuredClone(existing));
      continue;
    }
    if (same(l, r)) {
      entries.push(structuredClone(l));
      continue;
    }
    const merged = structuredClone(l);
    let clash = false;
    for (const key of Object.keys(l) as (keyof Entry)[]) {
      if (["id", "createdAt", "updatedAt"].includes(key)) continue;
      if (key === 'boardItems') { merged.boardItems=mergeItems(b?.boardItems||[],l.boardItems||[],r.boardItems||[]); continue; }
      if (key === 'attachments') { merged.attachments=mergeItems(b?.attachments||[],l.attachments||[],r.attachments||[]); continue; }
      if (key === 'list') {
        merged.list=mergeItems(b?.list||[],l.list||[],r.list||[]).map(line=>{
          const original=b?.list?.find(item=>item.id===line.id)?.completedDates||[],left=l.list?.find(item=>item.id===line.id),right=r.list?.find(item=>item.id===line.id);
          if(!left||!right)return line;
          return {...line,completedDates:[...new Set([...left.completedDates,...right.completedDates])].filter(day=>!original.includes(day)||left.completedDates.includes(day)&&right.completedDates.includes(day))};
        });continue;
      }
      if (["who", "requires", "completedDates", "tags"].includes(key)) {
        const original = (b?.[key] || []) as string[],
          left = l[key] as string[],
          right = r[key] as string[];
        Object.assign(merged, {
          [key]: [...new Set([...left, ...right])].filter(
            (v) =>
              !original.includes(v) || (left.includes(v) && right.includes(v)),
          ),
        });
      } else if (b && same(l[key], b[key]))
        Object.assign(merged, { [key]: r[key] });
      else if (!b || !same(r[key], b[key])) {
        if (!same(l[key], r[key])) clash = true;
      }
    }
    Object.assign(merged,reconcileList(merged));
    merged.createdAt = [l.createdAt, r.createdAt].sort()[0];
    merged.updatedAt = [l.updatedAt, r.updatedAt].sort().at(-1)!;
    // Concurrent edits to coupled fields (e.g. beginning/end) may be invalid together.
    try {
      decodeEntries([{ ...merged, requires: [], budgetId: "" }]);
    } catch {
      Object.assign(merged, structuredClone(l));
      clash = true;
    }
    entries.push(merged);
    if (clash) {
      conflicts++;
      // Keep the remote version as a separate entry instead of discarding its values.
      entries.push({
        ...structuredClone(r),
        id: crypto.randomUUID(),
        boardItems: r.boardItems.map(item => ({...item,id:crypto.randomUUID()})),
        name:
          r.name.length < 9940
            ? `${r.name} [Version preserved during automatic merge]`
            : r.name,
      });
    }
  }
  const map = new Map(entries.map((e) => [e.id, e]));
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(e: Entry) {
    if (visited.has(e.id)) return;
    visiting.add(e.id);
    e.requires = e.requires.filter((id) => {
      if (!map.has(id)) return false;
      if (visiting.has(id)) {
        conflicts++;
        return false;
      }
      visit(map.get(id)!);
      return true;
    });
    visiting.delete(e.id);
    visited.add(e.id);
  }
  for (const e of entries) {
    visit(e);
    const budget = map.get(e.budgetId);
    if (
      !e.transactionType ||
      !budget ||
      budget.id === e.id ||
      budget.budgetType !== e.transactionType
    )
      e.budgetId = "";
  }
  return { entries: decodeEntries(entries), conflicts };
}
export type Snapshot = { entries: Entry[]; revision: number; boardViews?:BoardItem[] };
export type SyncState = {
  entries: Entry[];
  baseEntries: Entry[] | null;
  revision: number | null;
  dirty: boolean;
  boardViews?:BoardItem[];
  baseBoardViews?:BoardItem[]|null;
};
export async function synchronize(
  initial: SyncState,
  read: () => Promise<Snapshot>,
  write: (revision: number, entries: Entry[], boardViews:BoardItem[]) => Promise<Snapshot>,
): Promise<Snapshot & { conflicts: number }> {
  let { entries, baseEntries, revision } = initial;
  let boardViews=initial.boardViews||[],baseBoardViews=initial.baseBoardViews||[];
  let conflicts = 0;
  if (!initial.dirty) return { ...(await read()), conflicts };
  for (let attempt = 0; attempt < 5; attempt++) {
    if (revision === null) {
      const remote = await read();
      const merged = mergeEntries(baseEntries, entries, remote.entries);
      boardViews=mergeItems(baseBoardViews,boardViews,remote.boardViews||[]);
      baseBoardViews=remote.boardViews||[];
      entries = merged.entries;
      conflicts += merged.conflicts;
      baseEntries = remote.entries;
      revision = remote.revision;
    }
    try {
      return { ...(await write(revision, entries,boardViews)), conflicts };
    } catch (error) {
      if (!(error instanceof SyncConflict)) throw error;
      const remote = await read();
      const merged = mergeEntries(baseEntries, entries, remote.entries);
      boardViews=mergeItems(baseBoardViews,boardViews,remote.boardViews||[]);
      baseBoardViews=remote.boardViews||[];
      entries = merged.entries;
      conflicts += merged.conflicts;
      baseEntries = remote.entries;
      revision = remote.revision;
    }
  }
  throw new Error(
    "The Sheet is changing frequently. Your local changes are safe; automatic sync will retry shortly.",
  );
}
