import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,occurrences,decodeEntries} from '../src/domain.ts';
import {freshCopy,futureCopy,replaceFuture,validateReplacementDate} from '../src/repeating-copy.ts';
import {newBoardItem} from '../src/board-model.ts';

const series=()=>({...blankEntry(),name:'Rent',note:'Original note',task:true,beginsOn:'2026-10-01',endsOn:'2026-10-03',beginsAt:'09:00',endsAt:'17:00',repeat:'Monthly',completed:true,completedDates:['2026-10-01'],boardItems:[newBoardItem('sticky')],list:[{id:'line',text:'Pay',completed:true,completedDates:['2026-10-01']}]});

test('separate repeating copies have independent progress and preserve the source schedule',()=>{
  const source=series(),before=structuredClone(source),copy=freshCopy(source);
  assert.notEqual(copy.id,source.id);assert.equal(copy.name,'Copy of Rent');
  assert.equal(copy.beginsOn,source.beginsOn);assert.equal(copy.repeat,source.repeat);
  assert.equal(copy.completed,false);assert.deepEqual(copy.completedDates,[]);
  assert.equal(copy.list[0].completed,false);assert.deepEqual(copy.list[0].completedDates,[]);
  assert.deepEqual(copy.boardItems,[]);copy.list[0].text='New line';
  assert.deepEqual(source,before);
});
test('ordinary copies keep their existing behavior',()=>{
  const source={...series(),repeat:'',completedDates:[]};
  assert.equal(freshCopy(source).completed,true);
});
test('future drafts shift ranges and preserve times without changing the original',()=>{
  const source=series(),before=structuredClone(source),copy=futureCopy(source,source,'2026-11-01');
  assert.equal(copy.name,source.name);assert.equal(copy.beginsOn,'2026-11-01');assert.equal(copy.endsOn,'2026-11-03');
  assert.equal(copy.beginsAt,'09:00');assert.equal(copy.endsAt,'17:00');
  assert.deepEqual(copy.completedDates,[]);assert.deepEqual(source,before);
});
test('saving a replacement cuts the original at the preceding date and retains earlier history',()=>{
  const source=series(),before=structuredClone(source),copy=futureCopy(source,source,'2026-11-01');
  const result=replaceFuture([source],source,copy),original=result[0];
  assert.equal(original.repeatUntil,'2026-10-31');assert.deepEqual(original.completedDates,source.completedDates);
  assert.deepEqual(original.list,source.list);assert.deepEqual(original.boardItems,source.boardItems);
  assert.deepEqual(occurrences(original,'2026-10-01','2027-01-01').map(o=>o.start),['2026-10-01']);
  assert.deepEqual(occurrences(result[1],'2026-10-01','2026-12-01').map(o=>o.start),['2026-11-01','2026-12-01']);
  assert.equal(decodeEntries(result).length,2);assert.deepEqual(source,before);
});
test('finite series retain their Until date in the replacement and allow an inclusive final start',()=>{
  const source={...series(),repeatUntil:'2026-12-01'};
  const copy=futureCopy(source,source,'2026-12-01'),result=replaceFuture([source],source,copy);
  assert.equal(result[0].repeatUntil,'2026-11-30');assert.equal(copy.repeatUntil,'2026-12-01');
  assert.equal(occurrences(copy,'2026-12-01','2027-12-01').length,1);
});
test('invalid dates and cutoffs outside the source schedule are rejected',()=>{
  const source={...series(),repeatUntil:'2026-12-01'};
  for(const date of ['','2026-02-30','2026-10-01','2026-09-30','2026-12-02'])assert.throws(()=>validateReplacementDate(source,date));
  assert.throws(()=>futureCopy({...source,endsOn:'2026-10-05'},{...source,repeatUntil:''},'2200-12-30'),/end by/);
});
test('concurrent notes and completions survive while concurrent schedule changes prevent the split',()=>{
  const source=series(),copy=futureCopy(source,source,'2026-11-01');
  const latest={...source,note:'Changed elsewhere',completedDates:['2026-10-01','2026-11-01']};
  const result=replaceFuture([latest],source,copy);
  assert.equal(result[0].note,latest.note);assert.deepEqual(result[0].completedDates,latest.completedDates);
  assert.throws(()=>replaceFuture([{...latest,repeat:'Weekly'}],source,copy),/schedule changed/);
  assert.throws(()=>replaceFuture([],source,copy),/deleted/);
});
test('invalid replacements leave inputs untouched and changing the draft start moves the cutoff',()=>{
  const source=series(),copy=futureCopy(source,source,'2026-11-01'),entries=[source],before=structuredClone(entries);
  assert.throws(()=>replaceFuture(entries,source,{...copy,endsOn:'2026-10-01'}),/end/);
  assert.deepEqual(entries,before);
  const result=replaceFuture(entries,source,{...copy,beginsOn:'2026-11-02',endsOn:'2026-11-04'});
  assert.equal(result[0].repeatUntil,'2026-11-01');
});
