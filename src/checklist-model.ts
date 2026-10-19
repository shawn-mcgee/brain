import type {Entry,ListItem} from './domain.ts';
import {dateKey,requirementDone} from './domain.ts';

export function checklistDate(entry:Entry,date?:string){return date||entry.beginsOn||entry.endsOn||dateKey(new Date());}
export function listItemDone(entry:Entry,line:ListItem,date?:string){return entry.repeat?line.completedDates.includes(checklistDate(entry,date)):line.completed;}
export function assertCanComplete(entry:Entry,entries:Entry[],date?:string){
  const blocked=entry.requires.map(id=>entries.find(other=>other.id===id)).find(other=>other&&!requirementDone(other,checklistDate(entry,date)));
  if(blocked)throw new Error(`Waiting on “${blocked.name}”. Complete it first.`);
}
function mark<T extends {completed:boolean;completedDates:string[]}>(value:T,repeat:boolean,done:boolean,date:string):T {
  return {...value,...(repeat?{completedDates:done?[...new Set([...value.completedDates,date])]:value.completedDates.filter(d=>d!==date)}:{completed:done})};
}
export function setTaskDone(entry:Entry,done:boolean,date?:string):Entry {
  const day=checklistDate(entry,date);
  return {...mark(entry,!!entry.repeat,done,day),list:entry.list.map(line=>mark(line,!!entry.repeat,done,day)),updatedAt:new Date().toISOString()};
}
export function reconcileList(entry:Entry):Entry {
  if(!entry.task||!entry.list.length)return entry;
  if(!entry.repeat)return {...entry,completed:entry.list.every(line=>line.completed)};
  const days=new Set([...entry.completedDates,...entry.list.flatMap(line=>line.completedDates)]);
  return {...entry,completedDates:[...days].filter(day=>entry.list.every(line=>line.completedDates.includes(day)))};
}
export function setListItemDone(entry:Entry,id:string,done:boolean,date?:string):Entry {
  const day=checklistDate(entry,date);
  return reconcileList({...entry,list:entry.list.map(line=>line.id===id?mark(line,!!entry.repeat,done,day):line),updatedAt:new Date().toISOString()});
}
