import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,decodeEntries} from '../src/domain.ts';
import {budgetGroups,reorderBudgets} from '../src/budget-order.ts';
import {mergeEntries} from '../src/sync.ts';

const plan=(name,group='')=>({...blankEntry(),name,group,budgetType:'expense'});
const names=entries=>budgetGroups(entries).map(group=>[group.name,...group.entries.map(entry=>entry.name)]);

test('budget groups start alphabetically, put ungrouped last, and exclude transactions',()=>{
  const entries=[plan('Rent','Home'),plan('Other'),plan('Food','Daily'),plan('Power','Home'),{...plan('Tracked','Home'),budgetType:'',transactionType:'expense'}];
  assert.deepEqual(names(entries),[['Daily','Food'],['Home','Rent','Power'],['','Other']]);
  assert.equal(entries[0].name,'Rent');
});

test('budget items move in either direction within their group without changing other thoughts',()=>{
  const entries=[plan('One','Home'),plan('Two','Home'),plan('Three','Home'),plan('Other','Daily')];
  const moved=reorderBudgets(entries,{kind:'item',source:entries[0].id,target:entries[2].id,after:true});
  assert.deepEqual(names(moved),[['Daily','Other'],['Home','Two','Three','One']]);
  assert.equal(moved[3],entries[3]);
  assert.deepEqual(names(reorderBudgets(moved,{kind:'item',source:entries[0].id,target:entries[1].id,after:false})),names(entries));
  assert.equal(reorderBudgets(entries,{kind:'item',source:entries[0].id,target:entries[3].id,after:false}),entries);
  assert.equal(reorderBudgets(entries,{kind:'item',source:entries[0].id,target:entries[0].id,after:true}),entries);
});

test('group moves preserve item order, include hidden members, and survive decode and sync',()=>{
  const base=[plan('Rent','Home'),plan('Power','Home'),plan('Food','Daily'),plan('Other')];
  const moved=reorderBudgets(base,{kind:'group',source:'',target:'Daily',after:false});
  assert.deepEqual(names(moved),[['','Other'],['Daily','Food'],['Home','Rent','Power']]);
  assert.equal(moved[0].budgetGroupOrder,moved[1].budgetGroupOrder);
  const saved=decodeEntries(JSON.parse(JSON.stringify(moved)));
  assert.deepEqual(names(saved),names(moved));
  assert.deepEqual(names(mergeEntries(base,base,saved).entries),names(moved));
  const filtered=saved.filter(entry=>entry.name!=='Power');
  assert.deepEqual(names(filtered),[['','Other'],['Daily','Food'],['Home','Rent']]);
});

test('legacy budgets get default ordering and malformed ranks are rejected',()=>{
  const legacy=plan('Old','Home');delete legacy.budgetOrder;delete legacy.budgetGroupOrder;
  const [decoded]=decodeEntries([legacy]);
  assert.equal(decoded.budgetOrder,-1);assert.equal(decoded.budgetGroupOrder,-1);
  for(const rank of [NaN,Infinity,-2,1.5,'0'])assert.throws(()=>decodeEntries([{...decoded,budgetOrder:rank}]),/budget order/);
});
