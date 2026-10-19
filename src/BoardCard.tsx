import { useState } from 'react';
import type { PointerEventHandler, KeyboardEventHandler } from 'react';
import type { Entry } from './domain';
import type { BoardItem } from './board-model';
import { boardColors, effectiveCardKind, effectiveCardColor, isPreviewImage } from './board-model';
import type { Connection } from './storage';
import { AttachmentImage } from './Attachments';
import BoardCalendar from './BoardCalendar';
import { entryTags } from './board-tags';

type Handle={onPointerDown:PointerEventHandler<HTMLElement>;onPointerMove:PointerEventHandler<HTMLElement>;onPointerUp:PointerEventHandler<HTMLElement>;onPointerCancel:PointerEventHandler<HTMLElement>;onKeyDown:KeyboardEventHandler<HTMLElement>};
export default function BoardCard({item,entry,entries,connection,token,onUpdate,onEntryChange,onEdit,onActivate,moveHandle,resizeHandle,dimmed=false}:{item:BoardItem;entry?:Entry;entries:Entry[];connection:Connection;token?:string;onUpdate:(patch:Partial<BoardItem>)=>void;onEntryChange:(entry:Entry,patch:Partial<Entry>)=>void;onEdit:(entry:Entry)=>void;onActivate:()=>void;moveHandle:Handle;resizeHandle:Handle;dimmed?:boolean}) {
  const [colorOpen,setColorOpen]=useState(false);
  const [photoId,setPhotoId]=useState<string|null>(null);
  const [editingCalendarName,setEditingCalendarName]=useState(false);
  const images=entry?.attachments.filter(isPreviewImage)||[];
  const index=Math.max(0,images.findIndex(image=>image.id===photoId));
  const photo=images[index];
  const kind=effectiveCardKind(item,entry?.attachments||[]);
  const title=kind==='calendar'?item.title||'Calendar':entry?.name||'Note';
  const body=entry?.note||'';
  const color=effectiveCardColor(item,entry?.attachments||[],entry?.color);
  const tags=entry?entryTags(entry):[];
  return <article className={`board-card ${kind} board-${color}${item.pinned?' is-pinned':''}${dimmed?' is-dimmed':''}`} style={{left:item.x,top:item.y,width:item.width,height:item.height,zIndex:Math.round(item.z)}} aria-label={title} onPointerDownCapture={event=>{if(event.button===0&&event.currentTarget.contains(event.target as Node))onActivate();}} onClickCapture={event=>{if(event.detail===0&&event.currentTarget.contains(event.target as Node))onActivate();}}>
    <div className="board-card-header" role="group" tabIndex={item.pinned?-1:0} aria-label={`${title}. ${item.pinned?'Position pinned.':'Drag header or use arrow keys to move.'}`} onPointerDown={event=>{if((event.target as Element).closest('button,input,select,textarea,a,summary,[contenteditable=true],.board-color-picker'))return;moveHandle.onPointerDown(event);}} onPointerMove={moveHandle.onPointerMove} onPointerUp={moveHandle.onPointerUp} onPointerCancel={moveHandle.onPointerCancel} onKeyDown={event=>{if(event.target===event.currentTarget)moveHandle.onKeyDown(event);}}>
      <span className="board-move" aria-hidden="true">⠿</span>
      {kind==='calendar'&&editingCalendarName?<input autoFocus className="board-card-name" aria-label="Calendar name" maxLength={500} value={title} onFocus={event=>event.target.select()} onChange={event=>onUpdate({title:event.target.value})} onBlur={()=>setEditingCalendarName(false)} onKeyDown={event=>{if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();setEditingCalendarName(false);}}}/>:<span className="board-card-name" title={title}>{title}</span>}
      <button type="button" className="board-edit" aria-label={`Edit ${title}`} title="Edit card" onClick={()=>{if(entry&&kind!=='calendar')onEdit(entry);else setEditingCalendarName(true);}}><span aria-hidden="true">{'\u270F\uFE0F'}</span></button>
      <div className="board-color-picker" onKeyDown={event=>{if(event.key==='Escape'){setColorOpen(false);event.stopPropagation()}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setColorOpen(false)}}>
        <button type="button" className={`board-color-swatch board-${color}`} aria-label={`Card color: ${color}`} aria-expanded={colorOpen} title="Change color" onClick={()=>setColorOpen(open=>!open)}><span/></button>
        {colorOpen&&<div className="board-color-options" role="group" aria-label="Card color">{boardColors.map(value=><button key={value} type="button" className={`board-color-swatch board-${value}`} title={value} aria-label={value} aria-pressed={color===value} onClick={()=>{if(entry)onEntryChange(entry,{color:value});else onUpdate({color:value,customColor:true});setColorOpen(false)}}><span/>{color===value&&<b aria-hidden="true">✓</b>}</button>)}</div>}
      </div>
      <button type="button" className="board-pin" aria-label={item.pinned?'Unpin position':'Pin position'} aria-pressed={!!item.pinned} title={item.pinned?'Unpin position':'Pin position'} onClick={()=>onUpdate({pinned:!item.pinned})}><span aria-hidden="true">📌</span></button>
      <button type="button" className="board-archive" aria-label={`Remove ${title} from board`} title="Remove from board; keep item" onClick={()=>onUpdate({archived:true})}><span aria-hidden="true">{'\u2716\uFE0F'}</span></button>
    </div>
    <div className="board-card-body">
      {kind==='calendar'?<BoardCalendar item={item} entries={entries.filter(other=>other.id!==entry?.id)} onUpdate={onUpdate} onEdit={onEdit}/>:kind==='polaroid'&&photo&&entry?<div className="board-polaroid">
        <AttachmentImage key={photo.id} file={photo} entryId={entry.id} connection={connection} token={token} interactive/>
        {images.length>1&&<div className="board-photo-navigation"><button type="button" aria-label="Previous photo" onClick={()=>setPhotoId(images[(index+images.length-1)%images.length].id)}>‹</button><span aria-live="polite">{index+1} / {images.length}</span><button type="button" aria-label="Next photo" onClick={()=>setPhotoId(images[(index+1)%images.length].id)}>›</button></div>}
        {body&&<p className="board-photo-caption">{body}</p>}
      </div>:<div className="board-note-text">{body}</div>}
    </div>
    <div className="board-card-footer"><div className="board-tags">{kind==='calendar'?<span className="board-tag">{item.calendarDynamic===false?'Fixed':'Current'} {item.calendarPeriod||'month'}</span>:tags.map((tag,index)=><span className="board-tag" key={index}>{tag}</span>)}</div><button className="board-resize" type="button" aria-label={`Resize ${title}. Drag or use arrow keys.`} {...resizeHandle}>↘</button></div>
  </article>;
}
