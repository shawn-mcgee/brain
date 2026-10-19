export type BoardKind = 'sticky' | 'polaroid' | 'calendar' | 'group';
export type BoardItem = { id: string; kind: BoardKind; x: number; y: number; width: number; height: number; z: number; color: string; showList?:boolean; customColor?:boolean; pinned?:boolean; collapsed?:boolean; archived?:boolean; title?:string; calendarPeriod?:'day'|'week'|'month'; calendarDynamic?:boolean; calendarDate?:string };
export type Attachment = { id: string; name: string; type: string; size: number; createdAt: string };
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const boardColors = ['yellow','pink','blue','green','white','purple','orange','gray'] as const;
export function newBoardItem(kind: BoardKind, x=0, y=0, z=1): BoardItem {
  return {id:crypto.randomUUID(),kind,x,y,width:kind==='calendar'?840:320,height:kind==='calendar'?850:360,z,color:kind==='calendar'?'blue':kind==='polaroid'?'white':'yellow',pinned:false,archived:false,...(kind==='calendar'?{title:'Calendar',calendarPeriod:'month' as const,calendarDynamic:true}:{})};
}
export function validateBoardFields(boardItems: unknown, attachments: unknown): string {
  if (!Array.isArray(boardItems) || boardItems.length>100 || !Array.isArray(attachments) || attachments.length>20) return 'Invalid board items or attachments.';
  const ids=new Set();
  for (const item of boardItems) {
    if (!item || typeof item.id!=='string' || !item.id || item.id.length>100 || ids.has(item.id) || !['sticky','polaroid','calendar','group'].includes(item.kind) || !boardColors.includes(item.color) || !['x','y','width','height','z'].every(k=>Number.isFinite(item[k]) && Math.abs(item[k])<=10000000) || item.width<220 || item.width>1200 || item.height<180 || item.height>1200) return 'Invalid board layout.';
    ids.add(item.id);
    if (['pinned','archived','calendarDynamic','customColor','collapsed','showList'].some(k=>item[k]!==undefined && typeof item[k]!=='boolean') || item.title!==undefined && (typeof item.title!=='string'||item.title.length>10000) || item.calendarPeriod!==undefined && !['day','week','month'].includes(item.calendarPeriod) || item.calendarDate!==undefined && !validBoardDate(item.calendarDate)) return 'Invalid board options.';
  }
  ids.clear();
  for (const file of attachments) {
    if (!file || typeof file.id!=='string' || !/^[\w-]{1,100}$/.test(file.id) || ids.has(file.id) || typeof file.name!=='string' || !file.name || file.name.length>500 || typeof file.type!=='string' || !/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(file.type) || !Number.isInteger(file.size) || file.size<0 || file.size>MAX_FILE_SIZE || typeof file.createdAt!=='string' || !Number.isFinite(Date.parse(file.createdAt)) || 'dataUrl' in file || 'data' in file) return 'Invalid attachment metadata.';
    ids.add(file.id);
  }
  if(JSON.stringify(boardItems).length>40000 || JSON.stringify(attachments).length>40000) return 'Item metadata is too large.';
  return '';
}
// Merge item IDs individually so two people can pin/move different cards or add
// different files without treating the whole entry as a conflicting edit.
export function mergeItems<T extends {id:string}>(base:T[],local:T[],remote:T[]):T[] {
  const b=new Map(base.map(v=>[v.id,v])),l=new Map(local.map(v=>[v.id,v])),r=new Map(remote.map(v=>[v.id,v]));
  const same=(x:unknown,y:unknown)=>JSON.stringify(x)===JSON.stringify(y);
  const result:T[]=[];
  for (const id of new Set([...b.keys(),...l.keys(),...r.keys()])) {
    const before=b.get(id),left=l.get(id),right=r.get(id);
    if (!left || !right) {const value=left||right;if(value&&(!before||!same(value,before)))result.push(structuredClone(value));continue;}
    const merged={...left};
    for (const key of new Set([...Object.keys(left),...Object.keys(right)]) as Set<keyof T>) if (before&&same(left[key],before[key])) merged[key]=right[key];
    result.push(merged);
  }
  return result;
}
export function isPreviewImage(file: Attachment) { return ['image/png','image/jpeg','image/gif','image/webp','image/avif'].includes(file.type); }
export function screenToBoard(point:{x:number;y:number},view:{x:number;y:number;zoom:number}) {return {x:(point.x-view.x)/view.zoom,y:(point.y-view.y)/view.zoom};}
export function zoomAtPoint(view:{x:number;y:number;zoom:number},point:{x:number;y:number},factor:number) {
  const world=screenToBoard(point,view),zoom=Math.max(.25,Math.min(2,view.zoom*factor));
  return {x:point.x-world.x*zoom,y:point.y-world.y*zoom,zoom};
}
type TouchPoint={x:number;y:number};
export function pinchBoardView(view:{x:number;y:number;zoom:number},start:readonly [TouchPoint,TouchPoint],current:readonly [TouchPoint,TouchPoint]){
  const midpoint=(points:readonly [TouchPoint,TouchPoint])=>({x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2});
  const distance=(points:readonly [TouchPoint,TouchPoint])=>Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
  const anchor=midpoint(start),next=midpoint(current);
  const zoomed=zoomAtPoint(view,anchor,distance(current)/Math.max(1,distance(start)));
  return {...zoomed,x:zoomed.x+next.x-anchor.x,y:zoomed.y+next.y-anchor.y};
}
export function wheelZoomFactor(delta:number,mode:number,pageHeight:number) {
  const pixels=delta*(mode===1?16:mode===2?pageHeight:1);
  // Respond to small pinch deltas while keeping large wheel ticks manageable.
  return Math.exp(-Math.max(-40,Math.min(40,pixels))*.01);
}
function validBoardDate(value:unknown):boolean { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value>='1900-01-01' && value<='2200-12-31' && Number.isFinite(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
export function decodeBoardViews(value:unknown):BoardItem[] {
  if(!Array.isArray(value)||value.some(item=>!item||!['calendar','group'].includes(item.kind)))throw new Error('Invalid board views.');
  const error=validateBoardFields(value,[]);if(error)throw new Error(error);
  return value as BoardItem[];
}
export function resizeBoardItem(item:BoardItem,dx:number,dy:number):Pick<BoardItem,'width'|'height'> {
  if(item.kind!=='calendar')return {width:Math.max(220,Math.min(1200,item.width+dx)),height:Math.max(180,Math.min(1200,item.height+dy))};
  const ratio=item.height/item.width;
  const delta=Math.abs(dx)>=Math.abs(dy)?dx:dy/ratio;
  const width=Math.max(Math.max(220,180/ratio),Math.min(Math.min(1200,1200/ratio),item.width+delta));
  return {width,height:width*ratio};
}
export function effectiveCardKind(item:BoardItem,attachments:Attachment[]):BoardKind { return item.kind==='calendar'?'calendar':attachments.some(isPreviewImage)?'polaroid':'sticky'; }
export function effectiveCardColor(item:BoardItem,attachments:Attachment[],entryColor='',hasChecklist=false):string {
  if(entryColor)return entryColor;
  const kind=effectiveCardKind(item,attachments);
  if(item.customColor)return item.color;
  if(hasChecklist&&kind!=='calendar')return 'green';
  if(kind!=='sticky'&&item.color==='yellow')return kind==='calendar'?'blue':'white';
  if(kind==='sticky'&&item.kind==='polaroid'&&item.color==='white')return 'yellow';
  return item.color;
}
