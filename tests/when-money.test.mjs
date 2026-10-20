import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,decodeEntries,occurrences,todoOccurrences,nextTask,validateEntry} from '../src/domain.ts';
import {moneyAmountFields,signedAmount,trackingDraft} from '../src/money-model.ts';

test('legacy single-ended dates migrate to linked dates without losing optional times or real ranges',()=>{
  for(const side of ['begins','ends'])for(const time of ['','09:30']) {
    const old={...blankEntry(),name:'Appointment',[`${side}On`]:'2026-10-19',[`${side}At`]:time};
    delete old.repeatUntil;
    const entry=decodeEntries([old])[0];
    assert.equal(entry.beginsOn,'2026-10-19');assert.equal(entry.endsOn,entry.beginsOn);
    assert.equal(entry.beginsAt,time);assert.equal(entry.endsAt,time);assert.equal(entry.repeatUntil,'');
    assert.equal(old[side==='begins'?'endsOn':'beginsOn'],'');
  }
  const range={...blankEntry(),name:'Trip',beginsOn:'2026-10-19',endsOn:'2026-10-22'};
  assert.deepEqual(decodeEntries([range]),[range]);
});
test('task ranges appear on overlap and remain due at the end',()=>{
  const entry={...blankEntry(),name:'Prepare',task:true,beginsOn:'2026-10-19',endsOn:'2026-10-22'};
  const [shown]=todoOccurrences([entry],'2026-10-20','Today');
  assert.equal(shown.start,'2026-10-19');assert.equal(shown.end,'2026-10-22');
});
test('Until includes the last start date and retains an overlapping final range',()=>{
  const entry={...blankEntry(),name:'Trip',beginsOn:'2026-10-19',endsOn:'2026-10-21',repeat:'Weekly',repeatUntil:'2026-10-26'};
  assert.deepEqual(occurrences(entry,'2026-10-19','2026-12-01').map(o=>o.start),['2026-10-19','2026-10-26']);
  assert.equal(occurrences(entry,'2026-10-28','2026-10-28').length,1);
  assert.equal(todoOccurrences([entry],'2026-10-29','All').length,0);
  assert.match(validateEntry({...entry,repeatUntil:'2026-10-18'},[entry]),/Until/);
  assert.match(validateEntry({...entry,repeatUntil:'2026-02-30'},[entry]),/valid date/);
});
test('exhausted repeating tasks disappear while completed history and overdue occurrences survive',()=>{
  const entry={...blankEntry(),name:'Task',task:true,beginsOn:'2026-10-19',endsOn:'2026-10-19',repeat:'Daily',repeatUntil:'2026-10-20',completedDates:['2026-10-19','2026-10-20']};
  assert.equal(nextTask(entry,'2026-11-01'),undefined);
  assert.equal(todoOccurrences([entry],'2026-11-01','All').length,0);
  assert.equal(todoOccurrences([entry],'2026-11-01','All',true).length,2);
  const overdue={...entry,completedDates:['2026-10-19']};
  assert.equal(todoOccurrences([overdue],'2026-11-01','All')[0].date,'2026-10-20');
});
test('signed money inputs preserve unsigned storage and clear mismatching budget links',()=>{
  const income={...blankEntry(),name:'Income',transactionType:'income',budgetId:'plan',amount:100};
  const expense={...income,...moneyAmountFields(income,-25)};
  assert.equal(expense.transactionType,'expense');assert.equal(expense.amount,25);assert.equal(expense.budgetId,'');assert.equal(signedAmount(expense),-25);
  assert.equal(moneyAmountFields(income,50).budgetId,undefined);
  const plan={...blankEntry(),budgetType:'expense'};
  assert.equal(moneyAmountFields(plan,30).budgetType,'income');
});
test('tracking drafts link to a plan without copying recurrence, completion, or placements',()=>{
  for(const type of ['income','expense']) {
    const plan={...blankEntry(),name:'Rent',budgetType:type,amount:1200,repeat:'Monthly',task:true,completed:true};
    const draft=trackingDraft(plan),prefilled=trackingDraft(plan,true);
    assert.notEqual(draft.id,plan.id);assert.equal(draft.name,`${type==='income'?'Income':'Expense'} for Rent`);
    assert.equal(draft.budgetType,'');assert.equal(draft.transactionType,type);assert.equal(draft.budgetId,plan.id);
    assert.equal(draft.amount,0);assert.equal(prefilled.amount,1200);assert.equal(signedAmount(prefilled),type==='expense'?-1200:1200);
    assert.equal(draft.repeat,'');assert.equal(draft.task,false);assert.deepEqual(draft.boardItems,[]);
    assert.equal(validateEntry(draft,[plan]),'');assert.ok(draft.note);assert.equal(draft.beginsOn,draft.endsOn);
    assert.equal(plan.completed,true);
  }
});
