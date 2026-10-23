import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,decodeEntries,todoOccurrences,occurrences} from '../src/domain.ts';
import {entrySearchText,copyEntry,defaultSections,fancyName,mediaPlaceholderReferences} from '../src/entry-attributes.ts';
import {viewTitle} from '../src/view-title.ts';
import {newBoardItem,resizeBoardItem,decodeBoardViews,effectiveCardColor} from '../src/board-model.ts';
import {groupBounds,packCards,translateCards} from '../src/board-groups.ts';
import {mergeEntries} from '../src/sync.ts';

test('relative titles distinguish day, week, and month offsets and year boundaries',()=>{
  const today='2026-10-19';
  for(const [period,date,title] of [
    ['Today',today,'Today, October 19'],['Today','2026-10-18','Yesterday, October 18'],['Today','2026-10-20','Tomorrow, October 20'],['Today','2026-10-17','October 17 (2 Days Ago)'],['Today','2026-10-21','October 21 (2 Days From Now)'],
    ['This Week',today,'This Week of October 18'],['This Week','2026-10-11','Last Week of October 11'],['This Week','2026-10-25','Next Week of October 25'],['This Week','2026-10-04','Week of October 4 (2 Weeks Ago)'],['This Week','2026-11-01','Week of November 1 (2 Weeks From Now)'],
    ['This Month',today,'This Month of October'],['This Month','2026-09-01','Last Month of September'],['This Month','2026-11-01','Next Month of November'],['This Month','2026-08-01','Month of August (2 Months Ago)'],['This Month','2026-12-01','Month of December (2 Months From Now)'],
  ])assert.equal(viewTitle(period,date,today),title);
  assert.equal(viewTitle('This Month','2027-01-01','2026-12-31'),'Next Month of January 2027');
});
test('undated tasks appear once in all Todo windows and never expand into calendar dates',()=>{
  const entry={...blankEntry(),name:'Whenever',task:true};
  for(const period of ['All','Today','This Week','This Month'])assert.equal(todoOccurrences([entry],'2026-10-19',period).length,1);
  assert.deepEqual(occurrences(entry,'2026-10-01','2026-10-31'),[]);
  assert.equal(todoOccurrences([{...entry,completed:true}],'2026-10-19','This Week').length,0);
});

test('compact Todo headings follow the navigated anchor rather than the unchanged period value',()=>{
  const today='2026-10-23';
  for(const [period,anchor,title] of [
    ['Today',today,'Today'],['Today','2026-10-22','Yesterday'],['Today','2026-10-24','Tomorrow'],
    ['This Week',today,'This Week'],['This Week','2026-10-16','Last Week'],['This Week','2026-10-30','Next Week'],
    ['This Month',today,'This Month'],['This Month','2026-09-23','Last Month'],['This Month','2026-11-23','Next Month'],
    ['All',today,'All'],
  ])assert.equal(viewTitle(period,anchor,today,true),title);
  assert.equal(viewTitle('This Week','2026-10-09',today,true),'Week of October 4 (2 Weeks Ago)');
});
test('new entry attributes migrate, search, validate, and merge independently',()=>{
  const base={...blankEntry(),name:'Dinner',where:'Library',tags:['book club'],group:'Evening',color:'purple'};
  const query=entrySearchText(base);
  for(const term of ['dinner','library','book club','evening','purple'])assert.ok(query.includes(term));
  assert.equal(effectiveCardColor(newBoardItem('sticky'),base.color),'purple');
  const old={...base};for(const key of ['where','tags','group','color'])delete old[key];
  assert.deepEqual(decodeEntries([old])[0].tags,[]);
  assert.equal(decodeEntries([old])[0].where,'');
  assert.throws(()=>decodeEntries([{...base,color:'invalid'}]));
  assert.throws(()=>decodeEntries([{...base,tags:[17]}]));
  const merged=mergeEntries([base],[{...base,tags:['book club','dinner']}],[{...base,tags:['book club','friends'],where:'Home'}]);
  assert.deepEqual(new Set(merged.entries[0].tags),new Set(['book club','dinner','friends']));
  assert.equal(merged.entries[0].where,'Home');
});
test('copying creates an unsaved independent draft with shared values and no board placement',()=>{
  const entry={...blankEntry(),name:'Original',note:'Body',who:['Sam'],where:'Home',group:'Plans',tags:['work'],boardItems:[newBoardItem('sticky')]};
  const copy=copyEntry(entry);
  assert.notEqual(copy.id,entry.id);assert.equal(copy.name,'Copy of Original');assert.equal(copy.note,'Body');assert.equal(copy.where,'Home');assert.deepEqual(copy.boardItems,[]);
  copy.who.push('Alex');assert.deepEqual(entry.who,['Sam']);
  assert.deepEqual(defaultSections('Budget'),['money']);assert.deepEqual(defaultSections('Todo'),['note','task','when']);assert.deepEqual(defaultSections('Calendar'),['note','when','where']);
  const count=80+Object.values(mediaPlaceholderReferences).reduce((sum,theme)=>sum+theme.beginnings.length,0);
  const names=new Set();for(let a=0;a<count;a++)for(let b=0;b<count;b++){let call=0;names.add(fancyName(()=>((call++?b:a)+.1)/count))}assert.equal(names.size,13456);
});
test('calendar resizing preserves its aspect ratio within stored layout bounds',()=>{
  const calendar=newBoardItem('calendar');assert.ok(calendar.width>=800);
  for(const [dx,dy] of [[200,0],[0,100],[-1000,-1000],[5000,5000]]){const resized=resizeBoardItem(calendar,dx,dy);assert.ok(Math.abs(resized.height/resized.width-calendar.height/calendar.width)<1e-10);assert.ok(resized.width>=220&&resized.width<=1200);assert.ok(resized.height>=180&&resized.height<=1200)}
});
test('group packing avoids overlap and translation moves even pinned members equally',()=>{
  const cards=Array.from({length:7},(_,index)=>({...newBoardItem('sticky'),x:100+index*50,y:200+index*70,width:240+index*20,height:300+index*10,pinned:index===0}));
  const bounds=groupBounds(cards);assert.equal(bounds.x,76);assert.equal(bounds.y,144);
  const moved=translateCards(cards,50,-30);moved.forEach((point,index)=>{assert.equal(point.x,cards[index].x+50);assert.equal(point.y,cards[index].y-30)});
  const packed=packCards(cards).map(point=>({...cards.find(item=>item.id===point.id),...point}));
  for(let a=0;a<packed.length;a++)for(let b=a+1;b<packed.length;b++){const left=packed[a],right=packed[b];assert.ok(left.x+left.width<=right.x||right.x+right.width<=left.x||left.y+left.height<=right.y||right.y+right.height<=left.y)}
  assert.equal(decodeBoardViews([{...newBoardItem('group'),title:'Work',collapsed:true,pinned:true}]).length,1);
});
