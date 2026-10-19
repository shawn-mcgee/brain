import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry} from '../src/domain.ts';
import {newBoardItem} from '../src/board-model.ts';
import {actualEntryChanges,sameEntryContent,sameValue} from '../src/entry-changes.ts';

test('timestamp-only saves and editor reorderings preserve the current workspace',()=>{
  const a={...blankEntry(),name:'A'},b={...blankEntry(),name:'B'},current=[a,b];
  const incoming=[{...b,updatedAt:'2099-01-01T00:00:00Z'},{...a,updatedAt:'2099-01-01T00:00:00Z'}];
  assert.equal(actualEntryChanges(current,incoming),current);
  assert.equal(sameEntryContent(a,incoming[1]),true);
  assert.equal(a.updatedAt,current[0].updatedAt);
});
test('equivalent reconstructed objects and board patches are no-ops',()=>{
  const a={...blankEntry(),name:'A',boardItems:[newBoardItem('sticky')]},current=[a];
  const reordered=Object.fromEntries(Object.entries(structuredClone(a)).reverse());
  assert.equal(actualEntryChanges(current,[reordered]),current);
  assert.equal(sameValue(a.boardItems,[{...a.boardItems[0],x:a.boardItems[0].x}]),true);
  assert.equal(sameValue([],undefined),false);
});
test('real text, checklist, and layout edits are retained while untouched entries retain identity',()=>{
  const a={...blankEntry(),name:'A',boardItems:[newBoardItem('sticky')]},b={...blankEntry(),name:'B'},current=[a,b];
  for(const patch of [{note:'Changed'},{boardItems:[{...a.boardItems[0],x:50}]},{boardItems:[{...a.boardItems[0],z:10}]},{list:[{id:'line',text:'Do this',completed:false,completedDates:[]}]}]){
    const result=actualEntryChanges(current,[{...b},{...a,...patch}]);
    assert.notEqual(result,current);assert.notEqual(result[0],a);assert.equal(result[1],b);
    assert.deepEqual(result[0],{...a,...patch});
  }
});
test('additions, deletions, and list reordering still count as changes',()=>{
  const a={...blankEntry(),name:'A'},b={...blankEntry(),name:'B'};
  assert.deepEqual(actualEntryChanges([a],[a,b]),[a,b]);
  assert.deepEqual(actualEntryChanges([a,b],[b]),[b]);
  assert.equal(sameValue(['first','second'],['second','first']),false);
});
