import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,todoOccurrences,occurrenceHighlight} from '../src/domain.ts';
import {entryTags} from '../src/board-tags.ts';

test('single-time tasks have one Due tag and a Due today highlight, including repeats',()=>{
  for(const time of ['','14:30'])for(const repeat of ['','Daily']){
    const entry={...blankEntry(),name:'Submit',task:true,beginsOn:'2026-10-20',endsOn:'2026-10-20',beginsAt:time,endsAt:time,repeat};
    const occurrence=todoOccurrences([entry],'2026-10-20','Today')[0];
    assert.equal(occurrenceHighlight(occurrence,'2026-10-20'),'Due today');
    const tags=entryTags(entry);
    assert.equal(tags.filter(tag=>tag.startsWith('Due ')).length,1);
    assert.equal(tags.some(tag=>tag.startsWith('Begins ')),false);
    if(time)assert.ok(tags.find(tag=>tag.startsWith('Due ')).endsWith(time));
  }
});
test('task ranges and ordinary events retain their start labels',()=>{
  const base={...blankEntry(),name:'Work',beginsOn:'2026-10-20',endsOn:'2026-10-20',beginsAt:'09:00',endsAt:'11:00'};
  for(const entry of [{...base,task:true}, {...base,endsAt:'09:00'}]){
    assert.equal(occurrenceHighlight(todoOccurrences([entry],'2026-10-20','Today')[0],'2026-10-20'),'Starts today');
    assert.ok(entryTags(entry).some(tag=>tag.startsWith('Begins ')));
  }
});
