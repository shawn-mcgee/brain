import type {BoardItem} from './board-model.ts';
export function groupBounds(items:BoardItem[],padding=24) {
  const x=Math.min(...items.map(item=>item.x))-padding,y=Math.min(...items.map(item=>item.y))-padding-32;
  return {x,y,width:Math.max(...items.map(item=>item.x+item.width))+padding-x,height:Math.max(...items.map(item=>item.y+item.height))+padding-y};
}
export function packCards(items:BoardItem[],gap=24):{id:string;x:number;y:number}[] {
  if(!items.length)return [];
  const ordered=[...items].sort((a,b)=>b.height-a.height||b.width-a.width||a.id.localeCompare(b.id));
  const area=items.reduce((sum,item)=>sum+(item.width+gap)*(item.height+gap),0),longest=Math.max(...items.map(item=>item.width));
  let best:{points:{id:string;x:number;y:number}[];width:number;height:number;score:number}|undefined;
  for(const factor of [.8,1,1.2,1.4,1.7]) {
    const target=Math.max(longest,Math.sqrt(area)*factor);let x=0,y=0,rowHeight=0,width=0;
    const points=ordered.map(item=>{if(x&&x+item.width>target){y+=rowHeight+gap;x=0;rowHeight=0;}const point={id:item.id,x,y};x+=item.width+gap;width=Math.max(width,x-gap);rowHeight=Math.max(rowHeight,item.height);return point;});
    const height=y+rowHeight,score=width*height*(1+Math.abs(Math.log(width/height))*.8);
    if(!best||score<best.score)best={points,width,height,score};
  }
  const anchorX=Math.max(-1e7,Math.min(1e7-best!.width,Math.min(...items.map(item=>item.x)))),anchorY=Math.max(-1e7,Math.min(1e7-best!.height,Math.min(...items.map(item=>item.y))));
  return best!.points.map(point=>({...point,x:anchorX+point.x,y:anchorY+point.y}));
}
export function translateCards(items:BoardItem[],dx:number,dy:number):{id:string;x:number;y:number}[] {
  if(!items.length)return [];
  const x=Math.max(-1e7-Math.min(...items.map(item=>item.x)),Math.min(1e7-Math.max(...items.map(item=>item.x)),dx));
  const y=Math.max(-1e7-Math.min(...items.map(item=>item.y)),Math.min(1e7-Math.max(...items.map(item=>item.y)),dy));
  return items.map(item=>({id:item.id,x:item.x+x,y:item.y+y}));
}
