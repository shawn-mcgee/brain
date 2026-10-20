import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBoardViewport} from '../src/board-viewport.ts';
import {zoomAtPoint,screenToBoard,pinchBoardView} from '../src/board-model.ts';

function harness(){
  let id=0;
  const frames=new Map(),timers=new Map(),paints=[],settled=[];
  const initial={x:80,y:60,zoom:1};
  const camera=createBoardViewport(initial,view=>paints.push(view),view=>settled.push(view),{
    frame:callback=>{frames.set(++id,callback);return id;},cancelFrame:id=>frames.delete(id),
    delay:callback=>{timers.set(++id,callback);return id;},cancelDelay:id=>timers.delete(id),
  });
  const flush=queue=>{const callbacks=[...queue.values()];queue.clear();callbacks.forEach(callback=>callback());};
  return {camera,initial,frames,timers,paints,settled,paint:()=>flush(frames),settle:()=>flush(timers)};
}
test('high frequency wheel events accumulate without repeated paints or React updates',()=>{
  const h=harness(),point={x:300,y:250};
  const anchor=screenToBoard(point,h.initial);
  let expected=h.initial;
  for(let i=0;i<200;i++){
    expected=zoomAtPoint(expected,point,1.001);
    h.camera.update(view=>zoomAtPoint(view,point,1.001));
  }
  assert.deepEqual(h.camera.get(),expected);
  assert.equal(h.frames.size,1);assert.equal(h.timers.size,1);
  assert.equal(h.paints.length,0);assert.equal(h.settled.length,0);
  h.paint();assert.deepEqual(h.paints,[expected]);assert.equal(h.settled.length,0);
  const nextAnchor=screenToBoard(point,h.camera.get());
  assert.ok(Math.abs(anchor.x-nextAnchor.x)<1e-9&&Math.abs(anchor.y-nextAnchor.y)<1e-9);
  h.settle();assert.deepEqual(h.settled,[expected]);
});
test('pinch then pan uses the latest viewport before React settles',()=>{
  const h=harness(),start=[{x:100,y:100},{x:200,y:100}],end=[{x:50,y:120},{x:250,y:120}];
  const pinched=pinchBoardView(h.initial,start,end);
  h.camera.update(pinched);
  const panStart=h.camera.get();
  h.camera.update({...panStart,x:panStart.x+30,y:panStart.y-15});
  h.paint();h.settle();
  assert.equal(h.paints.length,1);assert.equal(h.settled.length,1);
  assert.deepEqual(h.paints[0],{...pinched,x:pinched.x+30,y:pinched.y-15});
});
test('unmount cancels pending work and retains the latest view for persistence',()=>{
  const h=harness(),last={x:10,y:20,zoom:0.5};
  h.camera.update(last);h.camera.cancel();h.paint();h.settle();
  assert.equal(h.paints.length,0);assert.equal(h.settled.length,0);assert.deepEqual(h.camera.get(),last);
  // React Strict Mode can set up effects again after cleanup.
  h.camera.update(h.initial);h.paint();assert.deepEqual(h.paints,[h.initial]);
});
