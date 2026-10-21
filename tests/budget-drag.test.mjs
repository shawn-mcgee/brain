import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgetDrop,budgetDragOffsets} from '../src/budget-drag.ts';

test('item previews slide variable-height rows into their eventual saved positions',()=>{
  const slots=[{id:'a',top:100,height:80},{id:'b',top:180,height:160},{id:'c',top:340,height:100}];
  const offsets=budgetDragOffsets(slots,{kind:'item',source:'a',target:'c',after:true});
  assert.deepEqual([...offsets],[['b',-80],['c',-80],['a',260]]);
  assert.deepEqual(slots.map(slot=>slot.top),[100,180,340]);
  assert.deepEqual([...budgetDragOffsets(slots,{kind:'item',source:'c',target:'a',after:false})],[['c',-240],['a',100],['b',100]]);
});

test('group previews preserve gaps and support the unnamed group',()=>{
  const slots=[{id:'Home',top:50,height:300},{id:'Work',top:364,height:180},{id:'',top:558,height:250}];
  const offsets=budgetDragOffsets(slots,{kind:'group',source:'',target:'Home',after:false});
  assert.deepEqual([...offsets],[['',-508],['Home',264],['Work',264]]);
  assert.equal(budgetDragOffsets(slots,{kind:'group',source:'Home',target:'Home',after:true}).size,0);
  assert.equal(budgetDragOffsets(slots,{kind:'group',source:'Missing',target:'Home',after:true}).size,0);
});

test('frozen drop slots support both halves, gaps, and the ends of the list',()=>{
  const slots=[{id:'Home',top:50,height:300},{id:'',top:364,height:180}];
  assert.deepEqual(budgetDrop(slots,40),{target:'Home',after:false});
  assert.deepEqual(budgetDrop(slots,240),{target:'Home',after:true});
  assert.deepEqual(budgetDrop(slots,355),{target:'',after:false});
  assert.deepEqual(budgetDrop(slots,600),{target:'',after:true});
  assert.equal(budgetDrop([],100),null);
});
