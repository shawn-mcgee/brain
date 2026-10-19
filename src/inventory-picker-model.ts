import type {Entry} from './domain.ts';
import {entrySearchText} from './entry-attributes.ts';
import {isPreviewImage} from './board-model.ts';
export type InventoryFilters={search:string;person:string;group:string;type:string;status:string};
export function isOnBoard(entry:Entry){return entry.boardItems.some(item=>!item.archived);}
export function filterInventory(entries:Entry[],filters:InventoryFilters):Entry[]{
  const search=filters.search.trim().toLowerCase();
  return entries.filter(entry=>{
    if(search&&!entrySearchText(entry).includes(search)||filters.person&&!entry.who.includes(filters.person)||filters.group&&entry.group!==filters.group)return false;
    if(filters.type==='task'&&!entry.task||filters.type==='list'&&!entry.list.length||filters.type==='photo'&&!entry.attachments.some(isPreviewImage)||filters.type==='money'&&!entry.budgetType&&!entry.transactionType||filters.type==='note'&&!entry.note)return false;
    if(filters.status==='on-board'&&!isOnBoard(entry)||filters.status==='available'&&isOnBoard(entry))return false;
    return true;
  }).sort((a,b)=>Number(isOnBoard(a))-Number(isOnBoard(b))||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
