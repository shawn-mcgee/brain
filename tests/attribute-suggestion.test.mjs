import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attributeSuggestion} from '../src/attribute-suggestion.ts';

test('suggests a prefix completion while preserving typed case',()=>{
  assert.equal(attributeSuggestion('ho',['Home','Office']),'home');
  assert.equal(attributeSuggestion('Home',['Home','Homestead']),'');
  assert.equal(attributeSuggestion('',['Home']),'');
  assert.equal(attributeSuggestion('ome',['Home']),'');
});
test('completes only the current comma-separated value and excludes previous values',()=>{
  assert.equal(attributeSuggestion('Shawn,  ja',['Jane','Shawn'],true),'Shawn,  jane');
  assert.equal(attributeSuggestion('Shawn, sh',['Shawn'],true),'');
  assert.equal(attributeSuggestion('Shawn, ',['Jane'],true),'');
});
