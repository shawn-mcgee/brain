import {test} from 'node:test';
import assert from 'node:assert/strict';
import {masonryLayout,nearestPinTarget} from '../src/pinned-layout.ts';

test('masonry fills the shortest column without tall cards blocking the next row',()=>{
  const layout=masonryLayout([900,220,300,250],618);
  assert.equal(layout.cardWidth,300);
  assert.deepEqual(layout.positions,[{x:0,y:0},{x:318,y:0},{x:318,y:238},{x:318,y:556}]);
  assert.equal(layout.height,900);
});

test('masonry follows list order, fits narrow screens, and leaves no trailing gap',()=>{
  assert.deepEqual(masonryLayout([220,400,250],280),{
    cardWidth:280,positions:[{x:0,y:0},{x:0,y:238},{x:0,y:656}],height:906,
  });
  assert.equal(masonryLayout([],1000).height,0);
  assert.equal(masonryLayout([220],0).cardWidth,0);
  const heights=[300,800,250,600,220,900,350];
  for(const width of [320,618,1000]){
    const layout=masonryLayout(heights,width);
    layout.positions.forEach((position,index)=>{
      assert.ok(position.x>=0&&position.x+layout.cardWidth<=width+.001);
      if(index)assert.ok(position.y>=layout.positions[index-1].y);
      layout.positions.slice(0,index).forEach((other,previous)=>{
        if(position.x===other.x)assert.ok(position.y>=other.y+heights[previous]+18);
      });
    });
  }
});

test('drag targets use original rectangles including gaps and the final slot',()=>{
  const targets=[{id:'first',left:0,top:0,width:300,height:900},{id:'second',left:318,top:0,width:300,height:220},{id:'last',left:318,top:238,width:300,height:300}];
  assert.equal(nearestPinTarget(targets,400,100),'second');
  assert.equal(nearestPinTarget(targets,400,235),'last');
  assert.equal(nearestPinTarget(targets,400,1000),'last');
  assert.equal(nearestPinTarget(targets,100,500),'first');
  assert.equal(nearestPinTarget([],0,0),null);
});
