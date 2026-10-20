import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Entry } from './domain';
import { blankEntry } from './domain';
import { newBoardItem, screenToBoard, resizeBoardItem, zoomAtPoint, wheelZoomFactor, pinchBoardView } from './board-model';
import type { BoardItem, BoardKind } from './board-model';
import type { Connection } from './storage';
import BoardCard from './BoardCard';
import BoardInventoryPicker from './BoardInventoryPicker';
import {isOnBoard} from './inventory-picker-model';
import {entrySearchText} from './entry-attributes';
import {groupBounds,packCards,translateCards} from './board-groups';
type Viewport={x:number;y:number;zoom:number};
export default function Board({entries,boardViews,onViewsChange,connection,token,onCreate,onPin,onUpdate,onRemoveCard,onEntryChange,onLayout,onEdit}:{entries:Entry[];boardViews:BoardItem[];onViewsChange:(items:BoardItem[])=>void;connection:Connection;token?:string;onCreate:(entry:Entry)=>void;onPin:(entry:Entry,item:BoardItem)=>void;onUpdate:(entryId:string,itemId:string,patch:Partial<BoardItem>)=>void;onRemoveCard:(entryId:string,itemId:string)=>void;onEntryChange:(entry:Entry,patch:Partial<Entry>)=>void;onLayout:(moves:{entryId:string;itemId:string;patch:Partial<BoardItem>}[])=>void;onEdit:(entry:Entry)=>void}) {
  const viewport=useRef<HTMLDivElement>(null);
  const [view,setView]=useState<Viewport>(()=>{try{const saved=JSON.parse(localStorage.getItem('brain-board-view-v1')||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.zoom>=.25&&saved.zoom<=2)return saved;}catch{}return{x:80,y:60,zoom:1}});
  const [pickerOpen,setPickerOpen]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState('');
  const [panel,setPanel]=useState<'view'|'add'|null>(null);
  const controls=useRef<HTMLDivElement>(null),viewButton=useRef<HTMLButtonElement>(null),addButton=useRef<HTMLButtonElement>(null);
  const panelId=useId();
  useEffect(()=>{if(!panel)return;const outside=(event:PointerEvent)=>{if(!controls.current?.contains(event.target as Node))setPanel(null)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[panel]);
  const [size,setSize]=useState({width:1000,height:650});
  const [preview,setPreview]=useState<{id:string;patch:Partial<BoardItem>}|null>(null);
  const [groupPreview,setGroupPreview]=useState<Record<string,Partial<BoardItem>>>({});
  const groupGesture=useRef<{pointer:number;startX:number;startY:number;cards:{entry:Entry;item:BoardItem}[];points:{id:string;x:number;y:number}[]}|null>(null);
  const gesture=useRef<{pointer:number;mode:'pan'|'move'|'resize';startX:number;startY:number;view:Viewport;entryId?:string;item?:BoardItem;patch?:Partial<BoardItem>}|null>(null);
  const touches=useRef(new Map<number,{x:number;y:number}>());
  const pinch=useRef<{ids:[number,number];points:[{x:number;y:number},{x:number;y:number}];view:Viewport}|null>(null);
  const suppressClickUntil=useRef(0);
  function touchPoint(event:ReactPointerEvent<HTMLElement>){const rect=viewport.current!.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function touchStart(event:ReactPointerEvent<HTMLElement>){
    if(event.pointerType!=='touch')return;
    touches.current.set(event.pointerId,touchPoint(event));
    if(touches.current.size<2)return;
    event.preventDefault();event.stopPropagation();
    if(pinch.current)return;
    const ids=[...touches.current.keys()].slice(0,2) as [number,number];
    pinch.current={ids,points:[touches.current.get(ids[0])!,touches.current.get(ids[1])!],view};
    gesture.current=null;groupGesture.current=null;setPreview(null);setGroupPreview({});
    for(const id of ids)viewport.current?.setPointerCapture(id);
    suppressClickUntil.current=event.timeStamp+500;
  }
  function touchMove(event:ReactPointerEvent<HTMLElement>){
    if(event.pointerType!=='touch'||!touches.current.has(event.pointerId))return;
    touches.current.set(event.pointerId,touchPoint(event));
    const current=pinch.current;if(!current)return;
    event.preventDefault();event.stopPropagation();
    const [a,b]=current.ids.map(id=>touches.current.get(id));
    if(a&&b)setView(pinchBoardView(current.view,current.points,[a,b]));
  }
  function touchEnd(event:ReactPointerEvent<HTMLElement>){
    if(event.pointerType!=='touch')return;
    touches.current.delete(event.pointerId);
    if(!pinch.current)return;
    event.preventDefault();event.stopPropagation();suppressClickUntil.current=event.timeStamp+500;
    // Rebase when a finger lifts so one-finger panning can continue without a jump.
    pinch.current=null;gesture.current=null;
    if(event.type!=='pointercancel'&&touches.current.size===1){
      const [id,point]=[...touches.current][0],rect=viewport.current!.getBoundingClientRect();
      gesture.current={pointer:id,mode:'pan',startX:point.x+rect.left,startY:point.y+rect.top,view};
    }
    if(viewport.current?.hasPointerCapture(event.pointerId))viewport.current.releasePointerCapture(event.pointerId);
  }
  const all=useMemo(()=>[...entries.flatMap(entry=>entry.boardItems.map(item=>({entry,item}))),...boardViews.filter(item=>item.kind==='calendar').map(item=>({entry:undefined,item}))].filter(({item})=>!item.archived),[entries,boardViews]);
  // CSS z-index controls stacking; keep DOM order stable to preserve pointer capture.
  const groups=useMemo(()=>[...new Set(all.flatMap(({entry})=>entry?.group?[entry.group]:[]))].map(name=>{
    const cards=all.filter((card):card is {entry:Entry;item:BoardItem}=>!!card.entry&&card.entry.group===name);
    const state=boardViews.filter(item=>item.kind==='group'&&item.title===name).sort((a,b)=>a.id.localeCompare(b.id))[0];
    return {name,cards,state,bounds:groupBounds(cards.map(({item})=>({...item,...groupPreview[item.id],...(preview?.id===item.id?preview.patch:{})})))};
  }),[all,boardViews,groupPreview,preview]);
  const collapsedGroups=useMemo(()=>new Set(groups.filter(group=>group.state?.collapsed).map(group=>group.name)),[groups]);
  const matches=useMemo(()=>{const search=query.toLowerCase();return new Set(all.filter(({entry,item})=>!search||(entry?entrySearchText(entry):item.title?.toLowerCase()||'calendar').includes(search)).map(({item})=>item.id));},[all,query]);
  function setGroup(name:string,patch:Partial<BoardItem>){const state=boardViews.filter(item=>item.kind==='group'&&item.title===name).sort((a,b)=>a.id.localeCompare(b.id))[0];if(state)onViewsChange(boardViews.map(item=>item.id===state.id?{...item,...patch}:item));else onViewsChange([...boardViews,{...newBoardItem('group'),title:name,...patch}]);}
  function applyLayout(cards:{entry:Entry;item:BoardItem}[],points:{id:string;x:number;y:number}[]){onLayout(points.map(point=>({entryId:cards.find(card=>card.item.id===point.id)!.entry.id,itemId:point.id,patch:{x:point.x,y:point.y}})));}
  function update(item:BoardItem,entry:Entry|undefined,patch:Partial<BoardItem>){if(patch.archived){if(entry)onRemoveCard(entry.id,item.id);else onViewsChange(boardViews.filter(current=>current.id!==item.id));return;}if(entry)onUpdate(entry.id,item.id,patch);else onViewsChange(boardViews.map(current=>current.id===item.id?{...current,...patch}:current));}
  const maxZ=useMemo(()=>all.reduce((n,v)=>Math.max(n,v.item.z),0)+1,[all]);
  useEffect(()=>{if(!viewport.current)return;const observer=new ResizeObserver(items=>{const rect=items[0]?.contentRect;if(rect)setSize({width:rect.width,height:rect.height})});observer.observe(viewport.current);return()=>observer.disconnect()},[]);
  useEffect(()=>{const timer=setTimeout(()=>{try{localStorage.setItem('brain-board-view-v1',JSON.stringify(view))}catch{}},250);return()=>clearTimeout(timer)},[view]);
  useEffect(()=>{
    const element=viewport.current;if(!element)return;
    let mouse:{x:number;y:number}|null=null;
    const trackMouse=(event:PointerEvent)=>{if(event.pointerType==='mouse'||event.pointerType==='pen')mouse={x:event.clientX,y:event.clientY};};
    const forgetMouse=()=>{mouse=null;};
    const wheel=(event:WheelEvent)=>{
      const body=(event.target as HTMLElement).closest<HTMLElement>('.board-card-body');
      if(!event.ctrlKey&&!event.metaKey&&body&&body.scrollHeight>body.clientHeight)return;
      event.preventDefault();
      const box=element.getBoundingClientRect();
      const point={x:(mouse?.x??event.clientX)-box.left-element.clientLeft,y:(mouse?.y??event.clientY)-box.top-element.clientTop};
      setView(current=>{
        return zoomAtPoint(current,point,wheelZoomFactor(event.deltaY,event.deltaMode,element.clientHeight));
      });
    };
    element.addEventListener('pointermove',trackMouse);
    element.addEventListener('pointerenter',trackMouse);
    element.addEventListener('pointerleave',forgetMouse);
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>{element.removeEventListener('pointermove',trackMouse);element.removeEventListener('pointerenter',trackMouse);element.removeEventListener('pointerleave',forgetMouse);element.removeEventListener('wheel',wheel);};
  },[]);
  function center(kind:BoardKind){const width=kind==='calendar'?840:320,height=kind==='calendar'?850:360;return screenToBoard({x:Math.max(16,(size.width-width*view.zoom)/2),y:Math.max(16,(size.height-height*view.zoom)/2)},view)}
  function add(kind:BoardKind|'list',existing?:Entry){
    const cardKind=kind==='list'?'sticky':kind;
    const point=center(cardKind),item={...newBoardItem(cardKind,point.x,point.y,maxZ),...(kind==='list'?{showList:true,color:'green'}:{})};
    setError('');
    if(kind==='calendar'&&!existing){if(boardViews.length>=100){setError('The board can have up to 100 calendar views. Remove an existing view first.');return;}onViewsChange([...boardViews,item]);}
    else if(existing){if(isOnBoard(existing))return;if(existing.boardItems.length>=100){setError('This thought already has 100 board cards.');return;}onPin(existing,item);}
    else {const entry={...blankEntry(),name:kind==='list'?'New list':kind==='polaroid'?'Photo':'New note',boardItems:[item]};onCreate(entry);}
    setPanel(null);
  }
  function zoomBy(factor:number){setView(current=>zoomAtPoint(current,{x:size.width/2,y:size.height/2},factor))}
  function fit(){if(!all.length){setView({x:80,y:60,zoom:1});return;}const minX=Math.min(...all.map(v=>v.item.x)),minY=Math.min(...all.map(v=>v.item.y)),maxX=Math.max(...all.map(v=>v.item.x+v.item.width)),maxY=Math.max(...all.map(v=>v.item.y+v.item.height));const zoom=Math.max(.25,Math.min(1,(size.width-60)/(maxX-minX),(size.height-60)/(maxY-minY)));setView({x:(size.width-(maxX-minX)*zoom)/2-minX*zoom,y:(size.height-(maxY-minY)*zoom)/2-minY*zoom,zoom})}
  function recenter(){
    const centerX=all.length?(Math.min(...all.map(v=>v.item.x))+Math.max(...all.map(v=>v.item.x+v.item.width)))/2:0;
    const centerY=all.length?(Math.min(...all.map(v=>v.item.y))+Math.max(...all.map(v=>v.item.y+v.item.height)))/2:0;
    setView(current=>({...current,x:size.width/2-centerX*current.zoom,y:size.height/2-centerY*current.zoom}));
  }
  function begin(event:ReactPointerEvent<HTMLElement>,mode:'pan'|'move'|'resize',entry?:Entry,item?:BoardItem){if(event.button!==0||mode==='move'&&item?.pinned)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);const patch=item&&item.z<maxZ-1?{z:maxZ}:undefined;gesture.current={pointer:event.pointerId,mode,startX:event.clientX,startY:event.clientY,view,entryId:entry?.id,item,patch};if(item&&patch)setPreview({id:item.id,patch});}
  function move(event:ReactPointerEvent<HTMLElement>){if(groupGesture.current||gesture.current)event.stopPropagation();const group=groupGesture.current;if(group&&group.pointer===event.pointerId){group.points=translateCards(group.cards.map(card=>card.item),(event.clientX-group.startX)/view.zoom,(event.clientY-group.startY)/view.zoom);setGroupPreview(Object.fromEntries(group.points.map(point=>[point.id,{x:point.x,y:point.y}])));return;}const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;const dx=event.clientX-current.startX,dy=event.clientY-current.startY;if(current.mode==='pan')setView({...current.view,x:current.view.x+dx,y:current.view.y+dy});else if(current.item){const patch=current.mode==='move'?{x:Math.max(-10000000,Math.min(10000000,current.item.x+dx/current.view.zoom)),y:Math.max(-10000000,Math.min(10000000,current.item.y+dy/current.view.zoom))}:resizeBoardItem(current.item,dx/current.view.zoom,dy/current.view.zoom);current.patch={...current.patch,...patch};setPreview({id:current.item.id,patch:current.patch})}}
  function finish(event:ReactPointerEvent<HTMLElement>,cancel=false){const group=groupGesture.current;if(group&&group.pointer===event.pointerId){groupGesture.current=null;if(!cancel)applyLayout(group.cards,group.points);setGroupPreview({});if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);return;}const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;gesture.current=null;if(!cancel&&current.item&&current.patch)update(current.item,entries.find(entry=>entry.id===current.entryId),current.patch);setPreview(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}
  function handle(item:BoardItem,entry:Entry|undefined,mode:'move'|'resize') {
    return {
      onPointerDown:(event:ReactPointerEvent<HTMLElement>)=>begin(event,mode,entry,item),
      onPointerMove:move,
      onPointerUp:(event:ReactPointerEvent<HTMLElement>)=>finish(event),
      onPointerCancel:(event:ReactPointerEvent<HTMLElement>)=>finish(event,true),
      onKeyDown:(event:import('react').KeyboardEvent<HTMLElement>)=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||mode==='move'&&item.pinned)return;
        event.preventDefault();const step=event.shiftKey?50:10;
        const dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
        update(item,entry,mode==='move'?{x:Math.max(-1e7,Math.min(1e7,item.x+dx)),y:Math.max(-1e7,Math.min(1e7,item.y+dy)),z:maxZ}:resizeBoardItem(item,dx,dy));
      }
    };
  }
  return <section className="cork-board" aria-label="Cork board">
    <label className="board-search"><input aria-label="Search board" placeholder="Search board" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <div ref={controls} className="board-toolbar" role="group" aria-label="Canvas controls" onKeyDown={event=>{if(event.key==='Escape'&&panel){event.preventDefault();event.stopPropagation();(panel==='view'?viewButton:addButton).current?.focus();setPanel(null);}}}>
      <button ref={viewButton} type="button" className="board-control-button" aria-label="View controls" title="View controls" aria-expanded={panel==='view'} aria-controls={`${panelId}-view`} onClick={()=>setPanel(current=>current==='view'?null:'view')}><span aria-hidden="true">{'\u{1F50D}'}</span></button>
      <button ref={addButton} type="button" className="board-control-button" aria-label="Add to board" title="Add to board" aria-expanded={panel==='add'} aria-controls={`${panelId}-add`} onClick={()=>setPanel(current=>current==='add'?null:'add')}><span aria-hidden="true">{'\u{2795}'}</span></button>
      {panel==='view'&&<div id={`${panelId}-view`} className="board-control-panel" role="group" aria-label="View controls">
        <label className="board-zoom-picker">Zoom<select aria-label="Zoom percent" value={Math.round(view.zoom*100)} onChange={event=>zoomBy(Number(event.target.value)/100/view.zoom)}>{[...new Set([25,50,75,100,125,150,200,Math.round(view.zoom*100)])].sort((a,b)=>a-b).map(percent=><option key={percent} value={percent}>{percent}%</option>)}</select></label>
        <button type="button" className="secondary" onClick={fit}>Fit thoughts</button>
        <button type="button" className="secondary" onClick={recenter}>Recenter</button>
      </div>}
      {panel==='add'&&<div id={`${panelId}-add`} className="board-control-panel board-add-menu" role="group" aria-label="Add to board">
        <button type="button" className="secondary" onClick={()=>add('sticky')}>{'\u{1F4DD}'} New Note</button>
        <button type="button" className="secondary" onClick={()=>add('list')}>{'\u2611\uFE0F'} New List</button>
        <button type="button" className="secondary" onClick={()=>add('polaroid')}>{'\u{1F4F7}'} New Polaroid</button>
        <button type="button" className="secondary" onClick={()=>add('calendar')}>{'\u{1F4C5}'} New Calendar</button>
        <button type="button" className="secondary" onClick={()=>{setPanel(null);setPickerOpen(true);}}>{'\u{1F4CC}'} Add Existing</button>

      </div>}
    </div>
    {pickerOpen&&<BoardInventoryPicker entries={entries} onPin={entry=>add('sticky',entry)} onClose={()=>{setPickerOpen(false);requestAnimationFrame(()=>addButton.current?.focus());}}/>}
    {error&&<p className="error" role="alert">{error}</p>}
    <div ref={viewport} tabIndex={0} className="board-viewport" aria-label="Board canvas. Drag to pan, pinch to zoom, or use arrow keys." onPointerDownCapture={touchStart} onPointerMoveCapture={touchMove} onPointerUpCapture={touchEnd} onPointerCancelCapture={touchEnd} onClickCapture={event=>{if(event.timeStamp<suppressClickUntil.current){event.preventDefault();event.stopPropagation();}}} style={{backgroundPosition:`${view.x}px ${view.y}px`,backgroundSize:`${24*view.zoom}px ${24*view.zoom}px`}} onPointerDown={event=>{if(!(event.target as HTMLElement).closest('.board-card, .board-group-controls'))begin(event,'pan')}} onPointerMove={move} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onKeyDown={event=>{if(event.target!==event.currentTarget)return;const delta=event.shiftKey?100:40;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setView(v=>({...v,x:v.x+(event.key==='ArrowLeft'?delta:event.key==='ArrowRight'?-delta:0),y:v.y+(event.key==='ArrowUp'?delta:event.key==='ArrowDown'?-delta:0)}))}}}>
      {!all.length&&<div className="board-empty"><span aria-hidden="true">📌</span><h2>No thoughts pinned</h2><p>Create a board thought or pin an existing entry.</p></div>}
      <div className="board-world" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}>
        {groups.map(group=><div key={group.name} className={`board-group${group.state?.collapsed?' is-collapsed':''}`} style={{left:group.bounds.x,top:group.bounds.y,width:group.bounds.width,height:group.state?.collapsed?0:group.bounds.height}}>
          <div className="board-group-controls" style={{zIndex:maxZ+1}} role="group" tabIndex={group.state?.pinned?-1:0} data-pinned={!!group.state?.pinned} aria-label={`Group ${group.name}. Drag header or use arrow keys to move.`} onPointerDown={event=>{if((event.target as Element).closest('button,input,select,textarea,a,summary,[contenteditable=true]')||event.button!==0||group.state?.pinned)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);groupGesture.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,cards:group.cards,points:group.cards.map(card=>({id:card.item.id,x:card.item.x,y:card.item.y}))};}} onPointerMove={move} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onKeyDown={event=>{if(event.target!==event.currentTarget||group.state?.pinned||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const d=event.shiftKey?50:10;applyLayout(group.cards,translateCards(group.cards.map(card=>card.item),event.key==='ArrowLeft'?-d:event.key==='ArrowRight'?d:0,event.key==='ArrowUp'?-d:event.key==='ArrowDown'?d:0));}}>
            <span className="board-group-drag" aria-hidden="true">&#10303;</span>
            <strong title={group.name}>{group.name}</strong>
            <button type="button" aria-label={`Pin group ${group.name}`} aria-pressed={!!group.state?.pinned} onClick={()=>setGroup(group.name,{pinned:!group.state?.pinned})}>{'\u{1F4CC}'}</button>
            <button type="button" aria-label={`${group.state?.collapsed?'Show':'Hide'} group ${group.name}`} title={group.state?.collapsed?'Show cards':'Hide cards'} aria-expanded={!group.state?.collapsed} onClick={()=>setGroup(group.name,{collapsed:!group.state?.collapsed})}><span aria-hidden="true">{group.state?.collapsed?'\u{1F441}\uFE0F':'\u{1F648}'}</span></button>
            <button type="button" aria-label={`Pack group ${group.name}`} title="Pack cards" onClick={()=>applyLayout(group.cards,packCards(group.cards.map(card=>card.item)))}><span aria-hidden="true">{'\u{1F4D0}'}</span></button>
          </div>
        </div>)}
        {all.filter(({entry})=>!entry?.group||!collapsedGroups.has(entry.group)).map(({entry,item:stored})=>{const groupPatch=groupPreview[stored.id],cardPatch=preview?.id===stored.id?preview.patch:undefined;const item=groupPatch||cardPatch?{...stored,...groupPatch,...cardPatch}:stored;return <BoardCard key={item.id} item={item} entry={entry} entries={entries} connection={connection} token={token} onUpdate={patch=>update(item,entry,patch)} onEntryChange={onEntryChange} onEdit={onEdit} onActivate={()=>{if(stored.z<maxZ-1)update(stored,entry,{z:maxZ});}} moveHandle={handle(item,entry,'move')} resizeHandle={handle(item,entry,'resize')} dimmed={!matches.has(item.id)}/>})}
      </div>
    </div>
  </section>;
}
