import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry} from '../src/domain.ts';
import {newBoardItem} from '../src/board-model.ts';
import {filterInventory,isOnBoard} from '../src/inventory-picker-model.ts';

const filters={search:'',person:'',group:'',type:'',status:''};
test('inventory picker distinguishes existing placements from legacy removed cards',()=>{
  const entry={...blankEntry(),name:'Item'};
  assert.equal(isOnBoard(entry),false);
  assert.equal(isOnBoard({...entry,boardItems:[newBoardItem('sticky')]}),true);
  assert.equal(isOnBoard({...entry,boardItems:[{...newBoardItem('sticky'),archived:true}]}),false);
  assert.equal(isOnBoard({...entry,boardItems:[{...newBoardItem('sticky'),pinned:true}]}),true);
});
test('picker searches item attributes and checklist text with combined filters',()=>{
  const item={...blankEntry(),name:'Shopping',note:'For dinner',who:['Sam'],where:'Market',tags:['food'],group:'Home',task:true,list:[{id:'line',text:'Apples',completed:false,completedDates:[]}]};
  const other={...blankEntry(),name:'Shopping',group:'Work',boardItems:[newBoardItem('sticky')]};
  for(const search of ['SHOPPING','dinner','Sam','Market','food','Home','apples'])assert.ok(filterInventory([item,other],{...filters,search}).some(found=>found.id===item.id));
  assert.deepEqual(filterInventory([item,other],{...filters,person:'Sam',group:'Home',type:'list',status:'available'}),[item]);
  assert.deepEqual(filterInventory([item,other],{...filters,group:'Work',type:'task'}),[]);
  assert.deepEqual(filterInventory([item,other],{...filters,status:'on-board'}),[other]);
  assert.equal(filterInventory([item,other],filters).length,2);
});
test('type filters identify photos and money without fetching files',()=>{
  const image={...blankEntry(),name:'Photo',attachments:[{id:'photo',name:'pic.png',type:'image/png',size:1,createdAt:new Date().toISOString()}]};
  const budget={...blankEntry(),name:'Budget',budgetType:'expense'};
  assert.deepEqual(filterInventory([budget,image],{...filters,type:'photo'}),[image]);
  assert.deepEqual(filterInventory([budget,image],{...filters,type:'money'}),[budget]);
});
test('available items sort alphabetically before items already on the board',()=>{
  const pinned={...blankEntry(),name:'A pinned item',boardItems:[newBoardItem('sticky')]};
  const z={...blankEntry(),name:'Z available'},b={...blankEntry(),name:'B available'};
  assert.deepEqual(filterInventory([pinned,z,b],filters).map(entry=>entry.name),['B available','Z available','A pinned item']);
  assert.deepEqual(filterInventory([pinned,z,b],{...filters,search:'item'}),[pinned]);
});
