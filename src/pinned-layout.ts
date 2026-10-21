export function masonryLayout(heights:number[],width:number,gap=18,minWidth=300) {
  const columns=Math.max(1,Math.floor((width+gap)/(minWidth+gap)));
  const cardWidth=Math.max(0,(width-gap*(columns-1))/columns);
  const bottoms=Array<number>(columns).fill(0);
  const positions=heights.map(height=>{
    const column=bottoms.indexOf(Math.min(...bottoms));
    const position={x:column*(cardWidth+gap),y:bottoms[column]};
    bottoms[column]+=height+gap;
    return position;
  });
  return {cardWidth,positions,height:Math.max(0,...bottoms)- (heights.length?gap:0)};
}

export type PinTarget={id:string;left:number;top:number;width:number;height:number};
// Use the original slots throughout a drag so animated cards cannot move the targets.
export function nearestPinTarget(targets:PinTarget[],x:number,y:number):string|null {
  let nearest:string|null=null,horizontal=Infinity,vertical=Infinity;
  for(const target of targets){
    const dx=Math.max(target.left-x,0,x-target.left-target.width);
    const dy=Math.max(target.top-y,0,y-target.top-target.height);
    if(dx<horizontal||dx===horizontal&&dy<vertical){nearest=target.id;horizontal=dx;vertical=dy;}
  }
  return nearest;
}
