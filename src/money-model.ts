import {blankEntry,dateKey} from './domain.ts';
import type {Entry} from './domain.ts';

// Stored amounts stay unsigned so existing totals, backups, and linked plans remain compatible.
export function signedAmount(entry:Entry):number {
  return entry.amount*(entry.budgetType==='expense'||entry.transactionType==='expense'?-1:1);
}
export function moneyAmountFields(entry:Entry,amount:number):Partial<Entry> {
  const type=amount<0?'expense':'income';
  return {amount:Math.abs(amount),budgetType:entry.budgetType?type:'',transactionType:entry.transactionType?type:'',...(type!==(entry.budgetType||entry.transactionType)?{budgetId:''}:{})};
}
export function trackingDraft(plan:Entry,includeAmount=false):Entry {
  const draft=blankEntry(),date=dateKey(new Date());
  return {...draft,name:`${plan.budgetType==='income'?'Income':'Expense'} for ${plan.name}`.slice(0,10000),note:`Tracked ${plan.budgetType} for ${plan.name}`.slice(0,10000),beginsOn:date,endsOn:date,transactionType:plan.budgetType,budgetId:plan.id,amount:includeAmount?plan.amount:0};
}
