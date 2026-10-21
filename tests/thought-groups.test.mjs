import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,decodeEntries} from '../src/domain.ts';
import {newBoardItem,decodeBoardViews} from '../src/board-model.ts';
import {renameThoughtGroup,newestThoughts} from '../src/thought-groups.ts';
import {budgetGroups} from '../src/budget-order.ts';

const thought=(name,group)=>({...blankEntry(),name,group});
const state=(title,patch={})=>({...newBoardItem('group'),title,...patch});
test('thoughts show newest creation first regardless of edits or storage order',()=>{
  const older={...thought('Older',''),createdAt:'2026-10-01T12:00:00.000Z',updatedAt:'2026-10-21T12:00:00.000Z'};
  const newer={...thought('Newer',''),createdAt:'2026-10-20T12:00:00.000Z'};
  const newest={...thought('Newest',''),createdAt:'2026-10-20T13:00:00.000Z'};
  const entries=[newer,older,newest];
  assert.deepEqual(newestThoughts(entries).map(entry=>entry.name),['Newest','Newer','Older']);
  assert.deepEqual(entries,[newer,older,newest]);
});

test('renaming updates all thoughts and the board group state, leaving other thoughts and cards intact',()=>{
  const card=newBoardItem('sticky');
  const entries=[{...thought('Visible','Home'),boardItems:[card]},thought('Off board','Home'),{...thought('Budget','Home'),budgetType:'expense',budgetOrder:3,budgetGroupOrder:2},thought('Other','Work')];
  const views=[state('Home',{pinned:true,collapsed:true}),newBoardItem('calendar')];
  const result=renameThoughtGroup(entries,views,'Home','  Household  ');
  assert.deepEqual(result.entries.map(entry=>entry.group),['Household','Household','Household','Work']);
  assert.equal(result.entries[3],entries[3]);
  assert.deepEqual(result.entries[0].boardItems,[card]);
  assert.equal(result.entries[2].budgetOrder,3);assert.equal(result.entries[2].budgetGroupOrder,2);
  assert.deepEqual(result.boardViews,[{...views[0],title:'Household'},views[1]]);
  assert.deepEqual(decodeEntries(result.entries),result.entries);assert.deepEqual(decodeBoardViews(result.boardViews),result.boardViews);
  assert.equal(entries[0].group,'Home');assert.equal(views[0].title,'Home');
});

test('merging groups keeps destination settings and appends source budgets in their saved order',()=>{
  const entries=[{...thought('Source A','Home'),budgetType:'expense',budgetOrder:1,budgetGroupOrder:0},
    {...thought('Source B','Home'),budgetType:'income',budgetOrder:0,budgetGroupOrder:0},
    {...thought('Destination','Work'),budgetType:'expense',budgetOrder:0,budgetGroupOrder:2},thought('Note','Home')];
  const views=[state('Home',{collapsed:true}),state('Work',{pinned:true}),newBoardItem('calendar')];
  const result=renameThoughtGroup(entries,views,'Home','Work');
  assert.ok(result.entries.every(entry=>entry.group==='Work'));
  assert.deepEqual(result.boardViews,[views[1],views[2]]);
  const [group]=budgetGroups(result.entries);
  assert.deepEqual(group.entries.map(entry=>entry.name),['Destination','Source B','Source A']);
  assert.ok(group.entries.every(entry=>entry.budgetGroupOrder===2));
});

test('merging into a group with no saved board state uses its default settings',()=>{
  const entries=[thought('Source','Home'),thought('Destination','Work')];
  assert.deepEqual(renameThoughtGroup(entries,[state('Home',{collapsed:true})],'Home','Work').boardViews,[]);
});

test('clearing a name ungroups every member and removes group controls without deleting thoughts or cards',()=>{
  const entries=[{...thought('Rent','Home'),budgetType:'expense',budgetGroupOrder:0,boardItems:[newBoardItem('sticky')]},thought('Note','Home'),thought('Other','Work')];
  const views=[state('Home'),state('Work')];
  const result=renameThoughtGroup(entries,views,'Home','   ');
  assert.deepEqual(result.entries.map(entry=>entry.group),['','','Work']);
  assert.equal(result.entries[0].budgetGroupOrder,-1);
  assert.deepEqual(result.entries[0].boardItems,entries[0].boardItems);
  assert.deepEqual(result.boardViews,[views[1]]);
  assert.equal(result.entries.length,entries.length);
});

test('renaming to the same name, a vanished group, or the ungrouped section does nothing',()=>{
  const entries=[thought('Home','Home'),thought('Ungrouped','')],views=[state('Home')];
  for(const [source,target] of [['Home',' Home '],['Missing','Other'],['','Other']]) {
    const result=renameThoughtGroup(entries,views,source,target);
    assert.equal(result.entries,entries);assert.equal(result.boardViews,views);
  }
});
