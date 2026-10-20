import {addDays,dateKey,daysBetween,parseDate,validateEntry} from './domain.ts';
import type {Entry} from './domain.ts';
import {copyEntry} from './entry-attributes.ts';

export function freshCopy(entry:Entry):Entry {
  const copy=copyEntry(entry);
  if(!entry.repeat)return copy;
  return {...copy,completed:false,completedDates:[],list:copy.list.map(line=>({...line,completed:false,completedDates:[]}))};
}
export function validateReplacementDate(source:Entry,from:string):void {
  const anchor=source.beginsOn||source.endsOn;
  if(!source.repeat||!anchor)throw new Error('The original thought must have a repeating schedule.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||from<'1900-01-01'||from>'2200-12-31'||dateKey(parseDate(from))!==from)throw new Error('Choose a valid replacement date.');
  if(from<=anchor)throw new Error('Choose a replacement date after the original start date to preserve its history.');
  if(source.repeatUntil&&from>source.repeatUntil)throw new Error('Choose a replacement date on or before the original Until date.');
}
export function futureCopy(entry:Entry,source:Entry,from:string):Entry {
  validateReplacementDate(source,from);
  const copy=freshCopy(entry);
  const duration=entry.beginsOn&&entry.endsOn?daysBetween(entry.beginsOn,entry.endsOn):0;
  const end=addDays(from,duration);
  if(end>'2200-12-31')throw new Error('The replacement range must end by 2200.');
  return {...copy,name:entry.name,beginsOn:from,endsOn:end};
}
// Compute both items together, then let the caller persist them in one workspace save.
export function replaceFuture(entries:Entry[],source:Entry,replacement:Entry):Entry[] {
  const current=entries.find(entry=>entry.id===source.id);
  if(!current)throw new Error('The original thought was deleted. Cancel this draft and copy the current thought again.');
  const schedule=['beginsOn','endsOn','beginsAt','endsAt','repeat','repeatUntil'] as const;
  if(schedule.some(field=>current[field]!==source[field]))throw new Error('The original schedule changed while this draft was open. Cancel and copy the current thought again.');
  validateReplacementDate(current,replacement.beginsOn);
  if(replacement.id===source.id||entries.some(entry=>entry.id===replacement.id))throw new Error('The replacement must be a new thought.');
  const original={...current,repeatUntil:addDays(replacement.beginsOn,-1),updatedAt:new Date().toISOString()};
  const result=[...entries.map(entry=>entry.id===source.id?original:entry),replacement];
  for(const entry of [original,replacement]){const error=validateEntry(entry,result);if(error)throw new Error(error);}
  return result;
}
