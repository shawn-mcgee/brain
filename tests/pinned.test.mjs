import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,decodeEntries,todoOccurrences,validateEntry} from '../src/domain.ts';
import {pinnedEntries,prependNewPins,reorderPinned} from '../src/pinned-model.ts';
import {initializeEntrySection,initialEntrySections,removeEntrySection} from '../src/entry-sections.ts';
import {mergeEntries} from '../src/sync.ts';

const thought=(name,patch={})=>({...blankEntry(),name,...patch});
test('new pins and repins lead the saved order without disturbing existing pins',()=>{
  const a=thought('A',{pin:true,pinOrder:1}),b=thought('B',{pin:true,pinOrder:0}),legacy=thought('Legacy',{pin:true}),old=thought('Old',{createdAt:'2020-01-01T00:00:00.000Z'});
  const current=[a,b,legacy,old];
  const pinned=prependNewPins(current,current.map(entry=>entry.id===old.id?{...entry,pin:true}:entry));
  assert.deepEqual(pinnedEntries(decodeEntries(pinned)).map(entry=>entry.name),['Old','B','A','Legacy']);
  assert.equal(old.pin,false);assert.equal(a.pinOrder,1);
  assert.equal(prependNewPins(current,current),current);
  const copy=thought('Copy',{pin:true,pinOrder:1});
  const copied=prependNewPins(pinned,[...pinned,copy]);
  assert.deepEqual(pinnedEntries(copied).map(entry=>entry.name),['Copy','Old','B','A','Legacy']);
  const unpinned=copied.map(entry=>entry.id===old.id?{...entry,pin:false,pinOrder:-1}:entry);
  const repinned=prependNewPins(unpinned,unpinned.map(entry=>entry.id===old.id?{...entry,pin:true}:entry));
  assert.deepEqual(pinnedEntries(repinned).map(entry=>entry.name),['Old','Copy','B','A','Legacy']);
});
test('Pin migrates independently from existing board position locks and validates imports',()=>{
  const old=thought('Legacy',{boardItems:[{id:'card',kind:'sticky',x:0,y:0,width:320,height:360,z:1,color:'yellow',pinned:true}]});
  delete old.pin;delete old.pinOrder;
  const [entry]=decodeEntries([old]);
  assert.equal(entry.pin,false);assert.equal(entry.pinOrder,-1);assert.equal(entry.boardItems[0].pinned,true);
  assert.match(validateEntry({...entry,pinOrder:NaN},[entry]),/pin/);
  assert.throws(()=>decodeEntries([{...entry,pin:'yes'}]),/pin/i);
  const pinned=initializeEntrySection(entry,'pin');
  assert.equal(pinned.pin,true);assert.ok(initialEntrySections(pinned).includes('pin'));
  const removed=removeEntrySection({...pinned,pinOrder:3},['pin'],'pin').entry;
  assert.equal(removed.pin,false);assert.equal(removed.pinOrder,-1);assert.deepEqual(removed.boardItems,entry.boardItems);
});
test('Pinned order persists across round trips, includes only pins, and preserves other data',()=>{
  const a=thought('A',{pin:true,pinOrder:0}),b=thought('B',{pin:true,pinOrder:1}),c=thought('C',{pin:true,pinOrder:2}),other=thought('Other');
  const entries=[a,b,c,other],moved=reorderPinned(entries,c.id,a.id);
  assert.deepEqual(pinnedEntries(decodeEntries(moved)).map(entry=>entry.name),['C','A','B']);
  assert.equal(moved[3],other);assert.equal(entries[0].pinOrder,0);
  assert.equal(reorderPinned(entries,'missing',a.id),entries);
  const remote=entries.map(entry=>entry.id===a.id?{...entry,note:'Remote note'}:entry);
  const merged=mergeEntries(entries,moved,remote);
  assert.equal(merged.conflicts,0);assert.equal(merged.entries.find(entry=>entry.id===a.id).note,'Remote note');
  assert.deepEqual(pinnedEntries(merged.entries).map(entry=>entry.name),['C','A','B']);
});
test('Todo excludes actual transactions while retaining scheduled plans and normal tasks',()=>{
  const plan=thought('Rent',{budgetType:'expense',beginsOn:'2026-10-20',endsOn:'2026-10-20'}),
    tracked=thought('Paid rent',{transactionType:'expense',task:true,beginsOn:'2026-10-20',endsOn:'2026-10-20'}),
    undated=thought('Tracked task',{transactionType:'income',task:true}),normal=thought('Call',{task:true});
  for(const period of ['All','Today','This Week','This Month']){
    assert.deepEqual(new Set(todoOccurrences([plan,tracked,undated,normal],'2026-10-20',period,true).map(item=>item.entry.name)),new Set(['Rent','Call']));
  }
});
