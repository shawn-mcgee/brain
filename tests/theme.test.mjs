import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preferredTheme} from '../src/theme.ts';

test('explicit theme preferences override the system and missing or invalid preferences follow it',()=>{
  for(const systemDark of [true,false]){
    assert.equal(preferredTheme('dark',systemDark),'dark');
    assert.equal(preferredTheme('light',systemDark),'light');
    for(const stored of [null,'','invalid'])assert.equal(preferredTheme(stored,systemDark),systemDark?'dark':'light');
  }
});
