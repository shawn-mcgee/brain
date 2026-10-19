import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Entry } from './domain';
import { blankEntry } from './domain';
import { newBoardItem, screenToBoard } from './board-model';
import type { BoardItem, BoardKind } from './board-model';
import type { Connection } from './storage';
import BoardCard from './BoardCard';
type Viewport={x:number;y:number;zoom:number};
export default function Board({entries,boardViews,onViewsChange,connection,token,onCreate,onPin,onUpdate,onEdit}:{entries:Entry[];boardViews:BoardItem[];onViewsChange:(items:BoardItem[])=>void;connection:Connection;token?:string;onCreate:(entry:Entry)=>void;onPin:(entry:Entry,item:BoardItem)=>void;onUpdate:(entryId:string,itemId:string,patch:Partial<BoardItem>)=>void;onEdit:(entry:Entry)=>void}) {
  const viewport=useRef<HTMLDivElement>(null);
  const [view,setView]=useState<Viewport>(()=>{try{const saved=JSON.parse(localStorage.getItem('brain-board-view-v1')||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.zoom>=.25&&saved.zoom<=2)return saved;}catch{}return{x:80,y:60,zoom:1}});
  const [search,setSearch]=useState(''),[error,setError]=useState('');
  const [panel,setPanel]=useState<'view'|'add'|null>(null);
  const controls=useRef<HTMLDivElement>(null),viewButton=useRef<HTMLButtonElement>(null),addButton=useRef<HTMLButtonElement>(null);
  const panelId=useId();
  useEffect(()=>{if(!panel)return;const outside=(event:PointerEvent)=>{if(!controls.current?.contains(event.target as Node))setPanel(null)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[panel]);
  const [size,setSize]=useState({width:1000,height:650});
  const [preview,setPreview]=useState<{id:string;patch:Partial<BoardItem>}|null>(null);
  const gesture=useRef<{pointer:number;mode:'pan'|'move'|'resize';startX:number;startY:number;view:Viewport;entryId?:string;item?:BoardItem;patch?:Partial<BoardItem>}|null>(null);
  const every:{entry?:Entry;item:BoardItem}[]=[...entries.flatMap(entry=>entry.boardItems.map(item=>({entry,item}))),...boardViews.map(item=>({item}))];
  const all=every.filter(({item})=>!item.archived).sort((a,b)=>a.item.z-b.item.z);
  const archived=every.filter(({item})=>item.archived);
  function update(item:BoardItem,entry:Entry|undefined,patch:Partial<BoardItem>){if(entry)onUpdate(entry.id,item.id,patch);else onViewsChange(boardViews.map(current=>current.id===item.id?{...current,...patch}:current));}
  const maxZ=all.reduce((n,v)=>Math.max(n,v.item.z),0)+1;
  useEffect(()=>{if(!viewport.current)return;const observer=new ResizeObserver(items=>{const rect=items[0]?.contentRect;if(rect)setSize({width:rect.width,height:rect.height})});observer.observe(viewport.current);return()=>observer.disconnect()},[]);
  useEffect(()=>{const timer=setTimeout(()=>{try{localStorage.setItem('brain-board-view-v1',JSON.stringify(view))}catch{}},250);return()=>clearTimeout(timer)},[view]);
  useEffect(()=>{const element=viewport.current;if(!element)return;const wheel=(event:WheelEvent)=>{const body=(event.target as HTMLElement).closest<HTMLElement>('.board-card-body');if(!event.ctrlKey&&!event.metaKey&&body&&body.scrollHeight>body.clientHeight)return;event.preventDefault();const box=element.getBoundingClientRect();setView(current=>{if(!event.ctrlKey&&!event.metaKey)return{...current,x:current.x-event.deltaX,y:current.y-event.deltaY};const point={x:event.clientX-box.left,y:event.clientY-box.top},world=screenToBoard(point,current),zoom=Math.max(.25,Math.min(2,current.zoom*Math.exp(-event.deltaY*.002)));return{x:point.x-world.x*zoom,y:point.y-world.y*zoom,zoom}})};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel)},[]);
  function center(kind:BoardKind){const point=screenToBoard({x:size.width/2,y:size.height/2},view);return{x:point.x-(kind==='calendar'?210:160),y:point.y-(kind==='calendar'?245:180)}}
  function add(kind:BoardKind,existing?:Entry){
    const point=center(kind),item=newBoardItem(kind,point.x,point.y,maxZ);
    setError('');
    if(kind==='calendar'&&!existing){if(boardViews.length>=100){setError('The board can have up to 100 calendar views. Archive an existing view instead.');return;}onViewsChange([...boardViews,item]);}
    else if(existing){if(existing.boardItems.length>=100){setError('This entry already has 100 board items.');return;}onPin(existing,item);}
    else {const entry={...blankEntry(),name:kind==='polaroid'?'Photo':'New note',boardItems:[item]};onCreate(entry);}
    setPanel(null);
  }
  function zoomBy(factor:number){setView(current=>{const zoom=Math.max(.25,Math.min(2,current.zoom*factor)),point={x:size.width/2,y:size.height/2},world=screenToBoard(point,current);return{x:point.x-world.x*zoom,y:point.y-world.y*zoom,zoom}})}
  function fit(){if(!all.length){setView({x:80,y:60,zoom:1});return;}const minX=Math.min(...all.map(v=>v.item.x)),minY=Math.min(...all.map(v=>v.item.y)),maxX=Math.max(...all.map(v=>v.item.x+v.item.width)),maxY=Math.max(...all.map(v=>v.item.y+v.item.height));const zoom=Math.max(.25,Math.min(1,(size.width-60)/(maxX-minX),(size.height-60)/(maxY-minY)));setView({x:(size.width-(maxX-minX)*zoom)/2-minX*zoom,y:(size.height-(maxY-minY)*zoom)/2-minY*zoom,zoom})}
  function recenter(){
    const centerX=all.length?(Math.min(...all.map(v=>v.item.x))+Math.max(...all.map(v=>v.item.x+v.item.width)))/2:0;
    const centerY=all.length?(Math.min(...all.map(v=>v.item.y))+Math.max(...all.map(v=>v.item.y+v.item.height)))/2:0;
    setView(current=>({...current,x:size.width/2-centerX*current.zoom,y:size.height/2-centerY*current.zoom}));
  }
  function begin(event:ReactPointerEvent<HTMLElement>,mode:'pan'|'move'|'resize',entry?:Entry,item?:BoardItem){if(event.button!==0||mode==='move'&&item?.pinned)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);gesture.current={pointer:event.pointerId,mode,startX:event.clientX,startY:event.clientY,view,entryId:entry?.id,item};}
  function move(event:ReactPointerEvent<HTMLElement>){const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;const dx=event.clientX-current.startX,dy=event.clientY-current.startY;if(current.mode==='pan')setView({...current.view,x:current.view.x+dx,y:current.view.y+dy});else if(current.item){const patch=current.mode==='move'?{x:Math.max(-10000000,Math.min(10000000,current.item.x+dx/current.view.zoom)),y:Math.max(-10000000,Math.min(10000000,current.item.y+dy/current.view.zoom))}:{width:Math.max(220,Math.min(1200,current.item.width+dx/current.view.zoom)),height:Math.max(180,Math.min(1200,current.item.height+dy/current.view.zoom))};current.patch=patch;setPreview({id:current.item.id,patch})}}
  function finish(event:ReactPointerEvent<HTMLElement>,cancel=false){const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;gesture.current=null;if(!cancel&&current.item&&current.patch)update(current.item,entries.find(entry=>entry.id===current.entryId),{...current.patch,z:maxZ});setPreview(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}
  function handle(item:BoardItem,entry:Entry|undefined,mode:'move'|'resize') {
    return {
      onPointerDown:(event:ReactPointerEvent<HTMLButtonElement>)=>begin(event,mode,entry,item),
      onPointerMove:move,
      onPointerUp:(event:ReactPointerEvent<HTMLButtonElement>)=>finish(event),
      onPointerCancel:(event:ReactPointerEvent<HTMLButtonElement>)=>finish(event,true),
      onKeyDown:(event:import('react').KeyboardEvent<HTMLButtonElement>)=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||mode==='move'&&item.pinned)return;
        event.preventDefault();const step=event.shiftKey?50:10;
        const dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
        update(item,entry,mode==='move'?{x:Math.max(-1e7,Math.min(1e7,item.x+dx)),y:Math.max(-1e7,Math.min(1e7,item.y+dy)),z:maxZ}:{width:Math.max(220,Math.min(1200,item.width+dx)),height:Math.max(180,Math.min(1200,item.height+dy))});
      }
    };
  }
  return <section className="cork-board" aria-label="Cork board">
    <div ref={controls} className="board-toolbar" role="group" aria-label="Canvas controls" onKeyDown={event=>{if(event.key==='Escape'&&panel){event.preventDefault();event.stopPropagation();(panel==='view'?viewButton:addButton).current?.focus();setPanel(null);}}}>
      <button ref={viewButton} type="button" className="board-control-button" aria-label="View controls" title="View controls" aria-expanded={panel==='view'} aria-controls={`${panelId}-view`} onClick={()=>setPanel(current=>current==='view'?null:'view')}><span aria-hidden="true">{'\u{1F50D}'}</span></button>
      <button ref={addButton} type="button" className="board-control-button" aria-label="Add to board" title="Add to board" aria-expanded={panel==='add'} aria-controls={`${panelId}-add`} onClick={()=>setPanel(current=>current==='add'?null:'add')}><span aria-hidden="true">{'\u{2795}'}</span></button>
      {panel==='view'&&<div id={`${panelId}-view`} className="board-control-panel" role="group" aria-label="View controls">
        <label className="board-zoom-picker">Zoom<select aria-label="Zoom percent" value={Math.round(view.zoom*100)} onChange={event=>zoomBy(Number(event.target.value)/100/view.zoom)}>{[...new Set([25,50,75,100,125,150,200,Math.round(view.zoom*100)])].sort((a,b)=>a-b).map(percent=><option key={percent} value={percent}>{percent}%</option>)}</select></label>
        <button type="button" className="secondary" onClick={fit}>Fit items</button>
        <button type="button" className="secondary" onClick={recenter}>Recenter</button>
      </div>}
      {panel==='add'&&<div id={`${panelId}-add`} className="board-control-panel" role="group" aria-label="Add to board">
        <button type="button" className="secondary" onClick={()=>add('sticky')}>{'\u{1F4DD}'} Add card</button>
        <button type="button" className="secondary" onClick={()=>add('polaroid')}>{'\u{1F4F7}'} Add polaroid</button>
        <button type="button" className="secondary" onClick={()=>add('calendar')}>{'\u{1F4C5}'} Add calendar</button>
        <details className="board-existing-picker"><summary>Pin existing entry</summary><input aria-label="Find entry to pin" placeholder="Search entries" value={search} onChange={event=>setSearch(event.target.value)}/><div>{entries.filter(entry=>`${entry.name} ${entry.name}`.toLowerCase().includes(search.toLowerCase())).slice(0,50).map(entry=><button key={entry.id} type="button" onClick={()=>{add('sticky',entry);addButton.current?.focus();}}>{entry.name}</button>)}{!entries.length&&<p>No entries yet.</p>}</div></details>
        {archived.length>0&&<details className="board-existing-picker"><summary>Archived items ({archived.length})</summary><div>{archived.map(({item,entry})=><button key={item.id} type="button" onClick={()=>{const point=center(item.kind);update(item,entry,{archived:false,x:point.x,y:point.y,z:maxZ});setPanel(null);}}>{entry?.name||item.title||'Calendar'}</button>)}</div></details>}
      </div>}
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div ref={viewport} tabIndex={0} className="board-viewport" aria-label="Board canvas. Drag to pan or use arrow keys." style={{backgroundPosition:`${view.x}px ${view.y}px`,backgroundSize:`${24*view.zoom}px ${24*view.zoom}px`}} onPointerDown={event=>{if(!(event.target as HTMLElement).closest('.board-card'))begin(event,'pan')}} onPointerMove={move} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onKeyDown={event=>{if(event.target!==event.currentTarget)return;const delta=event.shiftKey?100:40;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setView(v=>({...v,x:v.x+(event.key==='ArrowLeft'?delta:event.key==='ArrowRight'?-delta:0),y:v.y+(event.key==='ArrowUp'?delta:event.key==='ArrowDown'?-delta:0)}))}}}>
      {!all.length&&<div className="board-empty"><span aria-hidden="true">📌</span><h2>No items pinned</h2><p>Create a board item or pin an existing entry.</p></div>}
      <div className="board-world" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}>
        {all.map(({entry,item:stored})=>{const item=preview?.id===stored.id?{...stored,...preview.patch}:stored;return <BoardCard key={item.id} item={item} entry={entry} entries={entries} connection={connection} token={token} onUpdate={patch=>update(item,entry,patch)} onEdit={onEdit} moveHandle={handle(item,entry,'move')} resizeHandle={handle(item,entry,'resize')}/>})}
      </div>
    </div>
  </section>;
}
