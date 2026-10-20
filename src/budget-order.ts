import type {Entry} from './domain.ts';

export type BudgetGroup={name:string;entries:Entry[]};
export type BudgetMove={kind:'group'|'item';source:string;target:string;after:boolean};
const rank=(value:number)=>value>=0?value:Infinity;

export function budgetGroups(entries:Entry[]):BudgetGroup[] {
  const groups=new Map<string,Entry[]>();
  for(const entry of entries)if(entry.budgetType) {
    const group=groups.get(entry.group)||[];
    group.push(entry);groups.set(entry.group,group);
  }
  const groupRank=(group:BudgetGroup)=>Math.min(...group.entries.map(entry=>rank(entry.budgetGroupOrder)));
  return [...groups].map(([name,items])=>({name,entries:items.sort((a,b)=>rank(a.budgetOrder)-rank(b.budgetOrder))}))
    .sort((a,b)=>groupRank(a)-groupRank(b)||(a.name===''?1:b.name===''?-1:a.name.localeCompare(b.name)));
}

// Reorder the full collection so filtered-out budgets keep their relative positions.
export function reorderBudgets(entries:Entry[],move:BudgetMove):Entry[] {
  if(move.source===move.target)return entries;
  const groups=budgetGroups(entries);
  const items=move.kind==='group'?groups:groups.find(group=>group.entries.some(entry=>entry.id===move.source))?.entries;
  if(!items)return entries;
  const keys=items.map(item=>'name' in item&&'entries' in item?item.name:(item as Entry).id);
  const from=keys.indexOf(move.source),to=keys.indexOf(move.target);
  if(from<0||to<0)return entries;
  keys.splice(from,1);keys.splice(keys.indexOf(move.target)+(move.after?1:0),0,move.source);
  const positions=new Map(keys.map((key,index)=>[key,index]));
  const group=move.kind==='item'?entries.find(entry=>entry.id===move.source)?.group:undefined;
  const field=move.kind==='group'?'budgetGroupOrder':'budgetOrder';
  const now=new Date().toISOString();
  return entries.map(entry=>{
    if(!entry.budgetType||move.kind==='item'&&entry.group!==group)return entry;
    const position=positions.get(move.kind==='group'?entry.group:entry.id);
    return position===undefined||entry[field]===position?entry:{...entry,[field]:position,updatedAt:now};
  });
}
