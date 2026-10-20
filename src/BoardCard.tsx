import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEventHandler, KeyboardEventHandler } from 'react';
import type { Entry } from './domain';
import type { BoardItem } from './board-model';
import { boardColors, effectiveCardKind, effectiveCardColor, isPreviewImage } from './board-model';
import type { Connection } from './storage';
import { AttachmentImage } from './Attachments';
import BoardCalendar from './BoardCalendar';
import { entryTags } from './board-tags';
import Checklist from './Checklist';
import InlineText from './InlineText';
import {isDone} from './domain';
import {assertCanComplete,checklistDate,setTaskDone} from './checklist-model';

type Handle={onPointerDown:PointerEventHandler<HTMLElement>;onPointerMove:PointerEventHandler<HTMLElement>;onPointerUp:PointerEventHandler<HTMLElement>;onPointerCancel:PointerEventHandler<HTMLElement>;onKeyDown:KeyboardEventHandler<HTMLElement>};
type BoardCardProps = {item:BoardItem;entry?:Entry;entries:Entry[];connection:Connection;token?:string;onUpdate:(patch:Partial<BoardItem>)=>void;onEntryChange:(entry:Entry,patch:Partial<Entry>)=>void;onEdit:(entry:Entry)=>void;onActivate:()=>void;moveHandle:Handle;resizeHandle:Handle;dimmed?:boolean};
function BoardCardContent({item,entry,entries,connection,token,onUpdate,onEntryChange,onEdit,onActivate,moveHandle,resizeHandle,dimmed=false}:BoardCardProps) {
  const [colorOpen,setColorOpen]=useState(false);
  const [photoId,setPhotoId]=useState<string|null>(null);
  const [editingCalendarName,setEditingCalendarName]=useState(false);
  const [listOpen,setListOpen]=useState(!!item.showList),[error,setError]=useState('');
  const images=entry?.attachments.filter(isPreviewImage)||[];
  const index=Math.max(0,images.findIndex(image=>image.id===photoId));
  const photo=images[index];
  const kind=effectiveCardKind(item,entry?.attachments||[]);
  const title=kind==='calendar'?item.title||'Calendar':entry?.name||'Note';
  const body=entry?.note||'';
  const color=effectiveCardColor(item,entry?.attachments||[],entry?.color,!!entry?.list.length);
  const tags=useMemo(()=>entry?entryTags(entry):[],[entry]);
  const calendarEntries=useMemo(()=>kind==='calendar'?entries.filter(other=>other.id!==entry?.id):entries,[entries,entry?.id,kind]);
  return <article className={`board-card ${kind} board-${color}${item.pinned?' is-pinned':''}${dimmed?' is-dimmed':''}`} style={{left:item.x,top:item.y,width:item.width,height:item.height,zIndex:Math.round(item.z)}} aria-label={title} onPointerDownCapture={event=>{if(event.button===0&&event.currentTarget.contains(event.target as Node))onActivate();}} onClickCapture={event=>{if(event.detail===0&&event.currentTarget.contains(event.target as Node))onActivate();}}>
    <div className="board-card-header" role="group" tabIndex={item.pinned?-1:0} aria-label={`${title}. ${item.pinned?'Position pinned.':'Drag header or use arrow keys to move.'}`} onPointerDown={event=>{if((event.target as Element).closest('button,input,select,textarea,a,summary,[contenteditable=true],.board-color-picker'))return;moveHandle.onPointerDown(event);}} onPointerMove={moveHandle.onPointerMove} onPointerUp={moveHandle.onPointerUp} onPointerCancel={moveHandle.onPointerCancel} onKeyDown={event=>{if(event.target===event.currentTarget)moveHandle.onKeyDown(event);}}>
      <span className="board-move" aria-hidden="true">⠿</span>
      {kind==='calendar'&&editingCalendarName?<input autoFocus className="board-card-name" aria-label="Calendar name" maxLength={500} value={title} onFocus={event=>event.target.select()} onChange={event=>onUpdate({title:event.target.value})} onBlur={()=>setEditingCalendarName(false)} onKeyDown={event=>{if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();setEditingCalendarName(false);}}}/>:<InlineText value={title} label={kind==='calendar'?'Edit calendar name':'Edit thought name'} className="board-card-name" required maxLength={kind==='calendar'?500:10000} onCommit={name=>{if(kind==='calendar')onUpdate({title:name});else if(entry)onEntryChange(entry,{name});}}/>}
      <button type="button" className="board-edit" aria-label={`Edit ${title}`} title="Edit card" onClick={()=>{if(entry&&kind!=='calendar')onEdit(entry);else setEditingCalendarName(true);}}><span aria-hidden="true">{'\u270F\uFE0F'}</span></button>
      <div className="board-color-picker" onKeyDown={event=>{if(event.key==='Escape'){setColorOpen(false);event.stopPropagation()}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setColorOpen(false)}}>
        <button type="button" className={`board-color-swatch board-${color}`} aria-label={`Card color: ${color}`} aria-expanded={colorOpen} title="Change color" onClick={()=>setColorOpen(open=>!open)}><span/></button>
        {colorOpen&&<div className="board-color-options" role="group" aria-label="Card color">{boardColors.map(value=><button key={value} type="button" className={`board-color-swatch board-${value}`} title={value} aria-label={value} aria-pressed={color===value} onClick={()=>{if(entry)onEntryChange(entry,{color:value});else onUpdate({color:value,customColor:true});setColorOpen(false)}}><span/>{color===value&&<b aria-hidden="true">✓</b>}</button>)}</div>}
      </div>
      <button type="button" className="board-pin" aria-label={item.pinned?'Unpin position':'Pin position'} aria-pressed={!!item.pinned} title={item.pinned?'Unpin position':'Pin position'} onClick={()=>onUpdate({pinned:!item.pinned})}><span aria-hidden="true">📌</span></button>
      <button type="button" className="board-archive" aria-label={`Remove ${title} from board`} title="Remove from board; keep thought" onClick={()=>onUpdate({archived:true})}><span aria-hidden="true">{'\u2716\uFE0F'}</span></button>
    </div>
    <div className="board-card-body">
      {kind==='calendar'?<BoardCalendar item={item} entries={calendarEntries} onUpdate={onUpdate} onEdit={onEdit}/>:kind==='polaroid'&&photo&&entry?<div className="board-polaroid">
        <AttachmentImage key={photo.id} itemName={entry.name} note={entry.note} file={photo} entryId={entry.id} connection={connection} token={token} onRemove={()=>onEntryChange(entry,{attachments:entry.attachments.filter(file=>file.id!==photo.id)})}/>
        {images.length>1&&<div className="board-photo-navigation"><button type="button" aria-label="Previous photo" onClick={()=>setPhotoId(images[(index+images.length-1)%images.length].id)}>‹</button><span aria-live="polite">{index+1} / {images.length}</span><button type="button" aria-label="Next photo" onClick={()=>setPhotoId(images[(index+1)%images.length].id)}>›</button></div>}
        {!entry.task&&<InlineText value={body} label="Edit photo caption" placeholder="Add a caption…" className="board-photo-caption" multiline onCommit={note=>onEntryChange(entry,{note})}/>}
      </div>:entry?!entry.task&&<InlineText value={body} label="Edit note" placeholder="Add a note…" className="board-note-text" multiline onCommit={note=>onEntryChange(entry,{note})}/>:<div className="board-note-text">{body}</div>}
      {entry&&kind!=='calendar'&&<>
        <div className="board-quick-actions">
          {entry.task&&<div className="board-task-toggle"><input type="checkbox" aria-label={body||title} checked={isDone(entry,checklistDate(entry))} onChange={event=>{
            try{if(event.target.checked)assertCanComplete(entry,entries);onEntryChange(entry,setTaskDone(entry,event.target.checked));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Could not update task.');}
          }}/><InlineText value={body} label="Edit task note" placeholder={isDone(entry,checklistDate(entry))?'Completed':'Mark complete'} className="board-task-note" multiline onCommit={note=>onEntryChange(entry,{note})}/></div>}
          {!entry.list.length&&!listOpen&&<button type="button" className="board-add-list" onClick={()=>setListOpen(true)}>＋ List</button>}
        </div>
        {error&&<p role="alert" className="error">{error}</p>}
        {(entry.list.length>0||listOpen)&&<div className={`board-card-checklist${entry.task?' board-task-checklist':''}`}><Checklist entry={entry} entries={entries} editable inline onChange={updated=>onEntryChange(entry,updated)}/></div>}
      </>}
    </div>
    <div className="board-card-footer"><div className="board-tags">{kind==='calendar'?<span className="board-tag">{item.calendarDynamic===false?'Fixed':'Current'} {item.calendarPeriod||'month'}</span>:tags.map((tag,index)=><span className="board-tag" key={index}>{tag}</span>)}</div><button className="board-resize" type="button" aria-label={`Resize ${title}. Drag or use arrow keys.`} {...resizeHandle}>↘</button></div>
  </article>;
}

const MemoBoardCard=memo(BoardCardContent);
// Board gestures change on every frame. Forward them through stable callbacks so
// unchanged card content can skip rendering without retaining stale gesture state.
export default function BoardCard(props:BoardCardProps){
  const latest=useRef(props);
  useLayoutEffect(()=>{latest.current=props;});
  const handlers=useMemo(()=>{
    const handle=(key:'moveHandle'|'resizeHandle'):Handle=>({
      onPointerDown:event=>latest.current[key].onPointerDown(event),
      onPointerMove:event=>latest.current[key].onPointerMove(event),
      onPointerUp:event=>latest.current[key].onPointerUp(event),
      onPointerCancel:event=>latest.current[key].onPointerCancel(event),
      onKeyDown:event=>latest.current[key].onKeyDown(event),
    });
    return {
      moveHandle:handle('moveHandle'),resizeHandle:handle('resizeHandle'),
      onUpdate:(patch:Partial<BoardItem>)=>latest.current.onUpdate(patch),
      onEntryChange:(entry:Entry,patch:Partial<Entry>)=>latest.current.onEntryChange(entry,patch),
      onEdit:(entry:Entry)=>latest.current.onEdit(entry),
      onActivate:()=>latest.current.onActivate(),
    };
  },[]);
  return <MemoBoardCard {...props} {...handlers}/>;
}
