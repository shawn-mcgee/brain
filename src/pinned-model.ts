import type {Entry} from './domain.ts';
export function pinnedEntries(entries:Entry[]):Entry[] {
  return entries.filter(entry=>entry.pin).sort((a,b)=>(a.pinOrder<0?Infinity:a.pinOrder)-(b.pinOrder<0?Infinity:b.pinOrder)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function reorderPinned(entries:Entry[],source:string,target:string):Entry[] {
  const ordered=pinnedEntries(entries);
  const from=ordered.findIndex(entry=>entry.id===source),to=ordered.findIndex(entry=>entry.id===target);
  if(from<0||to<0||from===to)return entries;
  ordered.splice(to,0,ordered.splice(from,1)[0]);
  const ranks=new Map(ordered.map((entry,index)=>[entry.id,index]));
  const now=new Date().toISOString();
  return entries.map(entry=>ranks.has(entry.id)&&entry.pinOrder!==ranks.get(entry.id)?{...entry,pinOrder:ranks.get(entry.id)!,updatedAt:now}:entry);
}
