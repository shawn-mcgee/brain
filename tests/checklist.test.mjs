import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,decodeEntries,validateEntry,isDone} from '../src/domain.ts';
import {setTaskDone,setListItemDone,listItemDone,assertCanComplete} from '../src/checklist-model.ts';
import {mergeEntries} from '../src/sync.ts';
import {initialEntrySections,initializeEntrySection,removeEntrySection,sectionNames} from '../src/entry-sections.ts';

const line=(id)=>({id,text:id,completed:false,completedDates:[]});
const task=()=>({...blankEntry(),name:'Clean',task:true,list:[line('Kitchen'),line('Bathroom')]});
test('a checklist completes and reopens its task in both directions',()=>{
  const original=task();
  const partial=setListItemDone(original,'Kitchen',true);
  assert.equal(partial.completed,false);
  const complete=setListItemDone(partial,'Bathroom',true);
  assert.equal(complete.completed,true);
  assert.equal(setListItemDone(complete,'Kitchen',false).completed,false);
  assert.ok(setTaskDone(original,true).list.every(item=>item.completed));
  assert.ok(setTaskDone(complete,false).list.every(item=>!item.completed));
  assert.ok(original.list.every(item=>!item.completed));
});
test('recurring checklist completion is independent for each occurrence',()=>{
  const original={...task(),repeat:'Weekly',endsOn:'2026-10-19'};
  const complete=setTaskDone(original,true,'2026-10-19');
  assert.equal(isDone(complete,'2026-10-19'),true);
  assert.equal(isDone(complete,'2026-10-26'),false);
  assert.ok(complete.list.every(item=>!listItemDone(complete,item,'2026-10-26')));
  const next=setTaskDone(complete,true,'2026-10-26');
  const reopened=setListItemDone(next,'Kitchen',false,'2026-10-19');
  assert.equal(isDone(reopened,'2026-10-19'),false);
  assert.equal(isDone(reopened,'2026-10-26'),true);
});
test('ordinary lists stay independent until the Task attribute is added',()=>{
  const list={...task(),task:false};
  const checked=setListItemDone(setListItemDone(list,'Kitchen',true),'Bathroom',true);
  assert.equal(checked.completed,false);
  assert.equal(initializeEntrySection(checked,'task').completed,true);
  assert.ok(initialEntrySections(checked).includes('list'));
  assert.deepEqual(removeEntrySection(checked,['list'],'list').entry.list,[]);
  assert.equal(sectionNames.requires,'Waiting on');
});
test('waiting on multiple tasks blocks completion until all are done',()=>{
  const a={...blankEntry(),name:'A',task:true,completed:true},b={...blankEntry(),name:'B',task:true};
  const dependent={...task(),requires:[a.id,b.id]};
  assert.throws(()=>assertCanComplete(dependent,[a,b]),/Waiting on.*B/);
  assert.doesNotThrow(()=>assertCanComplete(dependent,[a,{...b,completed:true}]));
});
test('legacy data gains an empty list and malformed list data is rejected',()=>{
  const original=task();delete original.list;
  assert.deepEqual(decodeEntries([original])[0].list,[]);
  for(const list of [null,[line('same'),line('same')],[{...line('x'),completed:'yes'}],[{...line('x'),text:''}],[{...line('x'),completedDates:['2026-02-30']}]])assert.ok(validateEntry({...task(),list},[]));
});
test('concurrent checklist edits merge by line and derive task completion',()=>{
  const base=task(),left=setListItemDone(base,'Kitchen',true),right=setListItemDone(base,'Bathroom',true);
  const result=mergeEntries([base],[left],[right]);
  assert.equal(result.conflicts,0);assert.equal(result.entries[0].completed,true);
  const recurring={...base,repeat:'Weekly',endsOn:'2026-10-19'};
  const combined=mergeEntries([recurring],[setTaskDone(recurring,true,'2026-10-19')],[setTaskDone(recurring,true,'2026-10-26')]);
  assert.deepEqual(combined.entries[0].completedDates.sort(),['2026-10-19','2026-10-26']);
});
