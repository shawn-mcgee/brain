import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveItem,mergedOrder} from '../src/reorder-model.ts';
import {blankEntry} from '../src/domain.ts';
import {mergeEntries} from '../src/sync.ts';

test('reordering moves one item without changing its data or the input array',()=>{
  const items=[{id:'a',completed:true},{id:'b',completed:false},{id:'c',completed:false}];
  const moved=moveItem(items,0,2);
  assert.deepEqual(moved.map(item=>item.id),['b','c','a']);
  assert.equal(moved[2],items[0]);assert.deepEqual(items.map(item=>item.id),['a','b','c']);
  assert.deepEqual(moveItem(moved,2,0),items);
  for(const [from,to] of [[-1,0],[0,3],[2,2]])assert.deepEqual(moveItem(items,from,to),items);
});

test('merge preserves a remote reorder when local order is unchanged and retains additions',()=>{
  assert.deepEqual(mergedOrder(['a','b'],['a','b'],['b','a'],['a','b']),['b','a']);
  assert.deepEqual(mergedOrder(['a','b'],['a','b','local'],['b','a','remote'],['a','b','local','remote']),['b','a','remote','local']);
  assert.deepEqual(mergedOrder(['a','b'],['b','a'],['a','b'],['a','b']),['b','a']);
});

test('sync preserves checklist order alongside remote line edits and completion',()=>{
  const list=['a','b','c'].map(id=>({id,text:id,completed:false,completedDates:[]}));
  const base={...blankEntry(),name:'Checklist',list};
  const local={...base,list:moveItem(list,0,2)};
  const remote={...base,list:list.map(item=>item.id==='b'?{...item,text:'Edited remotely',completed:true}:item)};
  const merged=mergeEntries([base],[local],[remote]);
  assert.equal(merged.conflicts,0);
  assert.deepEqual(merged.entries[0].list.map(item=>item.id),['b','c','a']);
  assert.equal(merged.entries[0].list[0].text,'Edited remotely');assert.equal(merged.entries[0].list[0].completed,true);
  const reversed=mergeEntries([base],[remote],[local]);
  assert.deepEqual(reversed.entries[0].list.map(item=>item.id),['b','c','a']);
});

test('sync preserves link reorders when another browser changes the thought note',()=>{
  const base={...blankEntry(),name:'Links',links:['https://a.example','https://b.example','https://c.example']};
  const reordered={...base,links:moveItem(base.links,2,0)},edited={...base,note:'Edited elsewhere'};
  for(const [left,right] of [[edited,reordered],[reordered,edited]]){
    const merged=mergeEntries([base],[left],[right]);
    assert.equal(merged.conflicts,0);assert.deepEqual(merged.entries[0].links,reordered.links);assert.equal(merged.entries[0].note,'Edited elsewhere');
  }
});
