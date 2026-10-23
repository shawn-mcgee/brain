import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,decodeEntries} from '../src/domain.ts';
import {newBoardItem,screenToBoard,validateBoardFields,mergeItems,decodeBoardViews,effectiveCardKind,effectiveCardColor,zoomAtPoint,wheelZoomFactor,pinchBoardView} from '../src/board-model.ts';
import {calendarWindow} from '../src/calendar-model.ts';
import {entryTags} from '../src/board-tags.ts';
import {mergeEntries} from '../src/sync.ts';

test('entries start unpinned and legacy imports receive empty board and file metadata',()=>{
  const entry={...blankEntry(),name:'Existing entry'};
  assert.deepEqual(entry.boardItems,[]);
  assert.deepEqual(entry.attachments,[]);
  delete entry.boardItems; delete entry.attachments;
  assert.deepEqual(decodeEntries([entry])[0].boardItems,[]);
  assert.deepEqual(decodeEntries([entry])[0].attachments,[]);
});

test('cards promote and demote automatically as image attachments change',()=>{
  const note=newBoardItem('sticky'),photo={id:'image',name:'Photo',type:'image/jpeg',size:0,createdAt:new Date().toISOString()};
  assert.equal(effectiveCardKind(note,[]),'sticky');
  assert.equal(effectiveCardKind(note,[photo]),'polaroid');
  assert.equal(effectiveCardColor(note),'');
  assert.equal(effectiveCardKind(note,[{...photo,type:'application/pdf'}]),'sticky');
  assert.equal(effectiveCardColor({...note,customColor:true,color:'yellow'}),'yellow');
  assert.equal(effectiveCardColor(newBoardItem('polaroid')),'');
  assert.equal(effectiveCardKind(newBoardItem('calendar'),[photo]),'calendar');
  assert.equal(newBoardItem('calendar').color,'blue');
});

test('cards use the app theme until a thought or card color is explicitly selected',()=>{
  for(const kind of ['sticky','polaroid','calendar']){
    const card=newBoardItem(kind);
    assert.equal(card.customColor,false);
    assert.equal(effectiveCardColor(card),'');
    assert.equal(effectiveCardColor(card,'pink'),'pink');
    assert.equal(effectiveCardColor({...card,customColor:true,color:'purple'}),'purple');
    assert.equal(effectiveCardColor({...card,customColor:true,color:'purple'},'blue'),'blue');
    assert.equal(effectiveCardColor({...card,customColor:true,color:'purple'},''),'');
    assert.equal(effectiveCardColor({...card,customColor:false,color:'purple'}),'');
  }
});

test('legacy card options merge when another browser adds pin, color, or archive fields',()=>{
  const legacy={id:'legacy',kind:'sticky',x:0,y:0,width:280,height:300,z:1,color:'yellow'};
  const result=mergeItems([legacy],[{...legacy,x:50}],[{...legacy,pinned:true,archived:true,customColor:true,color:'purple'}]);
  assert.equal(result[0].x,50);
  assert.equal(result[0].pinned,true);
  assert.equal(result[0].archived,true);
  assert.equal(result[0].color,'purple');
  assert.equal(result[0].customColor,true);
});

test('calendar views validate independently of entries and resolve fixed or current periods',()=>{
  const calendar=newBoardItem('calendar');
  assert.equal(decodeBoardViews([calendar]).length,1);
  assert.throws(()=>decodeBoardViews([newBoardItem('sticky')]));
  assert.throws(()=>decodeBoardViews([{...calendar,calendarDate:'2026-02-30'}]));
  assert.throws(()=>decodeBoardViews([{...calendar,pinned:'yes'}]));
  const current={...calendar,calendarPeriod:'week'};
  assert.deepEqual(calendarWindow(current,'2026-10-19'),{period:'week',anchor:'2026-10-19',from:'2026-10-18',to:'2026-10-24'});
  assert.equal(calendarWindow(current,'2026-10-26').from,'2026-10-25');
  const fixed={...calendar,calendarDynamic:false,calendarDate:'2024-02-29'};
  assert.equal(calendarWindow(fixed,'2026-10-19').to,'2024-02-29');
  assert.equal(calendarWindow({...fixed,calendarPeriod:'day'},'2026-10-19').from,'2024-02-29');
});

test('footer tags reflect entry attributes and omit absent enhancements',()=>{
  const entry={...blankEntry(),name:'Rent',note:'Description',task:true,who:['Shawn'],beginsOn:'2026-10-19',beginsAt:'09:30',endsOn:'2026-10-20',endsAt:'17:00',repeat:'Monthly',budgetType:'expense',amount:1250,requires:['another']};
  const tags=entryTags(entry);
  assert.ok(tags.includes('@Shawn'));
  assert.ok(tags.some(tag=>tag.includes('Task')));
  assert.ok(tags.some(tag=>tag.includes('Begins')&&tag.includes('09:30')));
  assert.ok(tags.some(tag=>tag.includes('Due')&&tag.includes('17:00')));
  assert.ok(tags.some(tag=>tag.includes('Monthly')));
  assert.ok(tags.some(tag=>tag.includes('Budget')&&tag.includes('expense')&&tag.includes('1,250')));
  assert.ok(!tags.includes(entry.name)&&!tags.includes(entry.note));
  assert.deepEqual(entryTags({...blankEntry(),name:'Just a name'}),[]);
});
test('board screen coordinates account for both panning and zoom',()=>{
  assert.deepEqual(screenToBoard({x:300,y:250},{x:100,y:50,zoom:2}),{x:100,y:100});
  assert.deepEqual(screenToBoard({x:0,y:0},{x:200,y:-100,zoom:.5}),{x:-400,y:200});
});

test('gesture zoom keeps the board point under the cursor fixed through repeated zooms and limits',()=>{
  for(const point of [{x:17,y:42},{x:873,y:591},{x:400,y:300}]) {
    let view={x:-153,y:87,zoom:.7};const world=screenToBoard(point,view);
    for(const delta of [-4,-12,-80,5,100,100,100,-15]) {
      view=zoomAtPoint(view,point,wheelZoomFactor(delta,0,600));
      const after=screenToBoard(point,view);
      assert.ok(Math.abs(after.x-world.x)<1e-9);assert.ok(Math.abs(after.y-world.y)<1e-9);
      assert.ok(view.zoom>=.25&&view.zoom<=2);
    }
  }
});

test('zoom responds strongly to small pinch deltas and normalizes wheel units',()=>{
  assert.ok(wheelZoomFactor(-10,0,600)>1.1);
  assert.equal(wheelZoomFactor(-16,0,600),wheelZoomFactor(-1,1,600));
  assert.ok(wheelZoomFactor(-1000,0,600)<1.5);
  const forward=wheelZoomFactor(-10,0,600),back=wheelZoomFactor(10,0,600);
  assert.ok(Math.abs(forward*back-1)<1e-12);
});
test('concurrent board edits merge by card and field; unpinning keeps the entry',()=>{
  const a=newBoardItem('sticky'),b=newBoardItem('polaroid');
  const base={...blankEntry(),name:'Shared',boardItems:[a,b]};
  const local={...base,boardItems:[{...a,x:100},b]};
  const remote={...base,boardItems:[{...a,color:'blue'},{...b,y:250}]};
  const result=mergeEntries([base],[local],[remote]);
  assert.equal(result.conflicts,0);
  assert.equal(result.entries.length,1);
  assert.equal(result.entries[0].boardItems[0].x,100);
  assert.equal(result.entries[0].boardItems[0].color,'blue');
  assert.equal(result.entries[0].boardItems[1].y,250);
  const unpinned=mergeEntries([base],[{...base,boardItems:[]}],[base]);
  assert.equal(unpinned.entries.length,1);
  assert.deepEqual(unpinned.entries[0].boardItems,[]);
});
test('independent attachments merge and metadata rejects bytes and invalid layouts',()=>{
  const file={id:'one',name:'one.png',type:'image/png',size:1,createdAt:new Date().toISOString()};
  const base={...blankEntry(),name:'Files'};
  const result=mergeEntries([base],[{...base,attachments:[file]}],[{...base,attachments:[{...file,id:'two'}]}]);
  assert.equal(result.entries[0].attachments.length,2);
  assert.equal(validateBoardFields([], [file]),'');
  assert.ok(validateBoardFields([],[{...file,dataUrl:'data:image/png;base64,YQ=='}]));
  assert.ok(validateBoardFields([],[{...file,size:2097153}]));
  assert.ok(validateBoardFields([{...newBoardItem('sticky'),x:Infinity}],[]));
});


test('touch pinch zoom follows the midpoint and supports simultaneous two-finger panning',()=>{
  const initial={x:40,y:-30,zoom:1},start=[{x:100,y:100},{x:200,y:100}];
  const before=screenToBoard({x:150,y:100},initial);
  const zoomed=pinchBoardView(initial,start,[{x:50,y:100},{x:250,y:100}]);
  assert.equal(zoomed.zoom,2);
  assert.deepEqual(screenToBoard({x:150,y:100},zoomed),before);
  const moved=pinchBoardView(initial,start,[{x:75,y:130},{x:275,y:130}]);
  assert.deepEqual(screenToBoard({x:175,y:130},moved),before);
  const pan=pinchBoardView(initial,start,[{x:120,y:140},{x:220,y:140}]);
  assert.deepEqual(pan,{x:60,y:10,zoom:1});
});
test('touch pinch respects zoom limits without losing the midpoint anchor',()=>{
  const initial={x:20,y:30,zoom:.5},start=[{x:100,y:100},{x:200,y:100}];
  const before=screenToBoard({x:150,y:100},initial);
  const tiny=pinchBoardView(initial,start,[{x:149,y:100},{x:151,y:100}]);
  assert.equal(tiny.zoom,.25);assert.deepEqual(screenToBoard({x:150,y:100},tiny),before);
  const huge=pinchBoardView(initial,start,[{x:-1000,y:100},{x:1300,y:100}]);
  assert.equal(huge.zoom,2);assert.deepEqual(screenToBoard({x:150,y:100},huge),before);
});
