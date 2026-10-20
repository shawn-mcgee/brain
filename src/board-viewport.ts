export type BoardViewport={x:number;y:number;zoom:number};
type Scheduler={
  frame:(callback:()=>void)=>number;
  cancelFrame:(id:number)=>void;
  delay:(callback:()=>void,ms:number)=>number;
  cancelDelay:(id:number)=>void;
};
// Accumulate every input immediately, but paint once per frame. React only
// needs the settled position for controls, rather than rendering every card.
export function createBoardViewport(initial:BoardViewport,paint:(view:BoardViewport)=>void,settle:(view:BoardViewport)=>void,scheduler:Scheduler){
  let paintView=paint;
  let current=initial,frame:number|undefined,timer:number|undefined;
  return {
    get:()=>current,
    onPaint(callback:(view:BoardViewport)=>void){paintView=callback;},
    update(next:BoardViewport|((view:BoardViewport)=>BoardViewport)){
      current=typeof next==='function'?next(current):next;
      if(frame===undefined)frame=scheduler.frame(()=>{frame=undefined;paintView(current);});
      if(timer!==undefined)scheduler.cancelDelay(timer);
      timer=scheduler.delay(()=>{timer=undefined;settle(current);},150);
    },
    cancel(){
      if(frame!==undefined)scheduler.cancelFrame(frame);
      if(timer!==undefined)scheduler.cancelDelay(timer);
      frame=undefined;timer=undefined;
    },
  };
}
