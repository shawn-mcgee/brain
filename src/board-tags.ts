import { parseDate } from './domain.ts';
import type { Entry } from './domain.ts';
export function entryTags(entry:Entry):string[] {
  const date=(value:string)=>parseDate(value).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const tags=entry.who.map(person=>`@${person}`);
  if(entry.where)tags.push(`📍 ${entry.where}`);
  if(entry.group)tags.push(`\u{1F4C1} ${entry.group}`);
  tags.push(...entry.tags.map(tag=>`#${tag}`));
  if(entry.task)tags.push(entry.completed?'✓ Done':'☐ Task');
  if(entry.beginsOn)tags.push(`Begins ${date(entry.beginsOn)}${entry.beginsAt?' '+entry.beginsAt:''}`);
  if(entry.endsOn)tags.push(`Due ${date(entry.endsOn)}${entry.endsAt?' '+entry.endsAt:''}`);
  if(entry.repeat)tags.push(`↻ ${entry.repeat}`);
  if(entry.budgetType||entry.transactionType)tags.push(`${entry.budgetType?'Budget':'Transaction'} · ${entry.budgetType||entry.transactionType} ${new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(entry.amount)}`);
  if(entry.requires.length)tags.push(`${entry.requires.length} prerequisite${entry.requires.length===1?'':'s'}`);
  if(entry.attachments.length)tags.push(`📎 ${entry.attachments.length}`);
  return tags;
}
