import { useState } from 'react';
import type { PointerEventHandler, KeyboardEventHandler } from 'react';
import type { Entry } from './domain';
import type { BoardItem } from './board-model';
import { boardColors, effectiveCardKind, effectiveCardColor, isPreviewImage } from './board-model';
import type { Connection } from './storage';
import { AttachmentImage } from './Attachments';
import BoardCalendar from './BoardCalendar';
import { entryTags } from './board-tags';

type Handle={onPointerDown:PointerEventHandler<HTMLButtonElement>;onPointerMove:PointerEventHandler<HTMLButtonElement>;onPointerUp:PointerEventHandler<HTMLButtonElement>;onPointerCancel:PointerEventHandler<HTMLButtonElement>;onKeyDown:KeyboardEventHandler<HTMLButtonElement>};
export default function BoardCard({item,entry,entries,connection,token,onUpdate,onEdit,moveHandle,resizeHandle}:{item:BoardItem;entry?:Entry;entries:Entry[];connection:Connection;token?:string;onUpdate:(patch:Partial<BoardItem>)=>void;onEdit:(entry:Entry)=>void;moveHandle:Handle;resizeHandle:Handle}) {
  const [colorOpen,setColorOpen]=useState(false);
  const [photoId,setPhotoId]=useState<string|null>(null);
  const images=entry?.attachments.filter(isPreviewImage)||[];
  const index=Math.max(0,images.findIndex(image=>image.id===photoId));
  const photo=images[index];
  const kind=effectiveCardKind(item,entry?.attachments||[]);
  const title=kind==='calendar'?item.title||'Calendar':entry?.name||'Note';
  const body=entry?.note||'';
  const color=effectiveCardColor(item,entry?.attachments||[]);
  const tags=entry?entryTags(entry):[];
  return <article className={`board-card ${kind} board-${color}${item.pinned?' is-pinned':''}`} style={{left:item.x,top:item.y,width:item.width,height:item.height,zIndex:Math.round(item.z)}} aria-label={title}>
    <div className="board-card-header">
      <button type="button" className="board-move" disabled={item.pinned} title={item.pinned?'Unpin to move':'Drag to move; arrow keys also move'} aria-label={`Move ${title}`} {...moveHandle}><span aria-hidden="true">⠿</span></button>
      {kind==='calendar'?<input className="board-card-name" aria-label="Calendar name" maxLength={500} value={title} onChange={event=>onUpdate({title:event.target.value})}/>:<button className="board-card-name" type="button" title={title} onClick={()=>entry&&onEdit(entry)}>{title}</button>}
      <div className="board-color-picker" onKeyDown={event=>{if(event.key==='Escape'){setColorOpen(false);event.stopPropagation()}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setColorOpen(false)}}>
        <button type="button" className={`board-color-swatch board-${color}`} aria-label={`Card color: ${color}`} aria-expanded={colorOpen} title="Change color" onClick={()=>setColorOpen(open=>!open)}><span/></button>
        {colorOpen&&<div className="board-color-options" role="group" aria-label="Card color">{boardColors.map(value=><button key={value} type="button" className={`board-color-swatch board-${value}`} title={value} aria-label={value} aria-pressed={color===value} onClick={()=>{onUpdate({color:value,customColor:true});setColorOpen(false)}}><span/>{color===value&&<b aria-hidden="true">✓</b>}</button>)}</div>}
      </div>
      <button type="button" className="board-pin" aria-label={item.pinned?'Unpin position':'Pin position'} aria-pressed={!!item.pinned} title={item.pinned?'Unpin position':'Pin position'} onClick={()=>onUpdate({pinned:!item.pinned})}><span aria-hidden="true">📌</span></button>
      <button type="button" className="board-archive" aria-label={`Archive ${title}`} title="Archive from board; keep entry" onClick={()=>onUpdate({archived:true})}><span aria-hidden="true">📥</span></button>
    </div>
    <div className="board-card-body">
      {kind==='calendar'?<BoardCalendar item={item} entries={entries.filter(other=>other.id!==entry?.id)} onUpdate={onUpdate} onEdit={onEdit}/>:kind==='polaroid'&&photo&&entry?<div className="board-polaroid">
        <AttachmentImage key={photo.id} file={photo} entryId={entry.id} connection={connection} token={token}/>
        {images.length>1&&<div className="board-photo-navigation"><button type="button" aria-label="Previous photo" onClick={()=>setPhotoId(images[(index+images.length-1)%images.length].id)}>‹</button><span aria-live="polite">{index+1} / {images.length}</span><button type="button" aria-label="Next photo" onClick={()=>setPhotoId(images[(index+1)%images.length].id)}>›</button></div>}
        {body&&<button type="button" className="board-photo-caption" onClick={()=>onEdit(entry)}>{body}</button>}
      </div>:<button type="button" className="board-note-text" aria-label={`Edit ${title}`} onClick={()=>entry&&onEdit(entry)}>{body}</button>}
    </div>
    <div className="board-card-footer"><div className="board-tags">{kind==='calendar'?<span className="board-tag">{item.calendarDynamic===false?'Fixed':'Current'} {item.calendarPeriod||'month'}</span>:tags.map((tag,index)=><span className="board-tag" key={index}>{tag}</span>)}</div><button className="board-resize" type="button" aria-label={`Resize ${title}. Drag or use arrow keys.`} {...resizeHandle}>↘</button></div>
  </article>;
}
