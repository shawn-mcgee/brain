import type {Entry} from './domain.ts';
import type {BoardItem} from './board-model.ts';
import {budgetGroups} from './budget-order.ts';

export function renameThoughtGroup(entries:Entry[],boardViews:BoardItem[],source:string,name:string) {
  const target=name.trim();
  if(!source||target===source||!entries.some(entry=>entry.group===source))return {entries,boardViews};
  const merging=entries.some(entry=>entry.group===target);
  const budgets=budgetGroups(entries);
  const destination=budgets.find(group=>group.name===target)?.entries||[];
  const incoming=budgets.find(group=>group.name===source)?.entries||[];
  const positions=new Map([...destination,...incoming].map((entry,index)=>[entry.id,index]));
  const ranks=destination.map(entry=>entry.budgetGroupOrder).filter(rank=>rank>=0);
  const groupOrder=ranks.length?Math.min(...ranks):-1;
  const now=new Date().toISOString();
  const nextEntries=entries.map(entry=>{
    const renamed=entry.group===source;
    const order=(merging||!target)&&entry.budgetType&&(renamed||entry.group===target)
      ? {budgetOrder:positions.get(entry.id)!,budgetGroupOrder:groupOrder}:{};
    if(!renamed&&(!Object.keys(order).length||entry.budgetOrder===order.budgetOrder&&entry.budgetGroupOrder===order.budgetGroupOrder))return entry;
    return {...entry,...order,...(renamed?{group:target}:{}),updatedAt:now};
  });
  // A merge keeps the destination group's board settings. A rename keeps the
  // original settings; ungrouping removes the obsolete group controls.
  const hasTargetState=boardViews.some(item=>item.kind==='group'&&item.title===target);
  const nextViews=boardViews.flatMap(item=>item.kind!=='group'||item.title!==source?[item]:!target||merging||hasTargetState?[]:[{...item,title:target}]);
  return {entries:nextEntries,boardViews:nextViews};
}
