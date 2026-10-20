import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,dateKey} from '../src/domain.ts';
import {initialEntrySections,availableEntrySections,removeEntrySection,initializeEntrySection,sectionOrder} from '../src/entry-sections.ts';

test('When defaults to today with linked dates and optional times',()=>{
  const empty=blankEntry(),entry=initializeEntrySection(empty,'when');
  assert.equal(entry.beginsOn,dateKey(new Date()));assert.equal(entry.endsOn,entry.beginsOn);
  assert.equal(entry.beginsAt,'');assert.equal(entry.endsAt,'');assert.equal(empty.beginsOn,'');
});
test('existing dates restore one When section and removing it clears repetition and history',()=>{
  const entry={...blankEntry(),name:'Plan',beginsOn:'2026-10-19',endsOn:'2026-10-21',repeat:'Weekly',repeatUntil:'2026-11-01',completedDates:['2026-10-19'],list:[{id:'line',text:'Prepare',completed:false,completedDates:['2026-10-19']}]};
  assert.deepEqual(initialEntrySections(entry),['list','when','repeat']);
  const removed=removeEntrySection(entry,['when','repeat'],'when');
  assert.deepEqual(removed.sections,[]);
  for(const field of ['beginsOn','endsOn','beginsAt','endsAt','repeat','repeatUntil'])assert.equal(removed.entry[field],'');
  assert.deepEqual(removed.entry.completedDates,[]);assert.deepEqual(removed.entry.list[0].completedDates,[]);
});
test('removing Repeats keeps dates and clears its limit',()=>{
  const entry={...blankEntry(),beginsOn:'2026-10-19',endsOn:'2026-10-19',repeat:'Daily',repeatUntil:'2026-11-01'};
  const result=removeEntrySection(entry,['when','repeat'],'repeat');
  assert.deepEqual(result.sections,['when']);assert.equal(result.entry.beginsOn,entry.beginsOn);assert.equal(result.entry.repeatUntil,'');
});
test('attribute buttons follow requested order and conditional availability',()=>{
  assert.deepEqual(availableEntrySections([]),sectionOrder.filter(section=>!['repeat','requires'].includes(section)));
  assert.ok(availableEntrySections(['when']).includes('repeat'));
  assert.ok(availableEntrySections(['task']).includes('requires'));
  const entry={...blankEntry(),task:true,requires:['other']};
  const removed=removeEntrySection(entry,['task','requires'],'task');
  assert.deepEqual(removed.sections,[]);assert.deepEqual(removed.entry.requires,[]);
});
test('removing Note leaves the name intact',()=>{
  const result=removeEntrySection({...blankEntry(),name:'Shopping',note:'Milk'},['note'],'note');
  assert.equal(result.entry.name,'Shopping');assert.equal(result.entry.note,'');
});
