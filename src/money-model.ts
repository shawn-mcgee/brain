import {blankEntry,dateKey} from './domain.ts';
import type {Entry} from './domain.ts';

// Stored amounts stay unsigned so existing totals, backups, and linked plans remain compatible.
export function signedAmount(entry:Entry):number {
  return entry.amount*(entry.budgetType==='expense'||entry.transactionType==='expense'?-1:1);
}
export function budgetProgress(plan:Entry,transactions:Entry[]) {
  let tracked=0,opposing=0;
  for(const entry of transactions) {
    if(entry.budgetId!==plan.id||!entry.transactionType)continue;
    if(entry.transactionType===plan.budgetType)tracked+=entry.amount;
    else {tracked-=entry.amount;opposing+=entry.amount;}
  }
  const percent=plan.amount>0?tracked/plan.amount*100:null;
  return {tracked,opposing,percent,fill:percent===null?(tracked>0?100:0):Math.max(0,Math.min(100,percent)),exceeded:tracked>plan.amount};
}
export function moneyAmountFields(entry:Entry,amount:number):Partial<Entry> {
  const type=amount<0?'expense':'income';
  return {amount:Math.abs(amount),budgetType:entry.budgetType?type:'',transactionType:entry.transactionType?type:'',...(type!==(entry.budgetType||entry.transactionType)?{budgetId:''}:{})};
}
export function trackingDraft(plan:Entry,includeAmount=false):Entry {
  const draft=blankEntry(),date=dateKey(new Date());
  return {...draft,name:`${plan.budgetType==='income'?'Income':'Expense'} for ${plan.name}`.slice(0,10000),note:`Tracked ${plan.budgetType} for ${plan.name}`.slice(0,10000),beginsOn:date,endsOn:date,transactionType:plan.budgetType,budgetId:plan.id,amount:includeAmount?plan.amount:0};
}
