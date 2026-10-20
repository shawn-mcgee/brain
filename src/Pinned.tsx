import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';
import type {Entry} from './domain';
import {isDone} from './domain';
import {assertCanComplete,checklistDate,setTaskDone} from './checklist-model';
import type {Connection} from './storage';
import {boardColors,isPreviewImage} from './board-model';
import {AttachmentImage} from './Attachments';
import {entryTags} from './board-tags';
import Checklist from './Checklist';
import InlineText from './InlineText';
import LocationLinks from './LocationLinks';
import {pinnedEntries,reorderPinned} from './pinned-model';

function PinnedCard({entry,entries,connection,token,onEdit,onEntryChange,onTrack,onUnpin,grip}:{onUnpin:(entry:Entry)=>void;grip:ReactNode;entry:Entry;entries:Entry[];connection:Connection;token?:string;onEdit:(entry:Entry)=>void;onTrack:(entry:Entry)=>void;onEntryChange:(entry:Entry,patch:Partial<Entry>)=>void}) {
  const [photoId,setPhotoId]=useState('');
  const [colorOpen,setColorOpen]=useState(false);
  const colorPicker=useRef<HTMLDivElement>(null),colorButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!colorOpen)return;
    const outside=(event:PointerEvent)=>{if(!colorPicker.current?.contains(event.target as Node))setColorOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[colorOpen]);
  const [taskError,setTaskError]=useState('');
  const [listOpen,setListOpen]=useState(false);
  const cardRef=useRef<HTMLElement>(null);
  const [hovered,setHovered]=useState(false);
  useEffect(()=>{
    if(!hovered||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let frame=0,start:number|undefined;
    let previous:HTMLButtonElement|null=null;
    function scrollName(now:number){
      const title=cardRef.current?.querySelector<HTMLButtonElement>('button.pinned-title')||null;
      if(title!==previous){if(previous)previous.scrollLeft=0;previous=title;start=undefined;}
      if(title){
        const distance=title.scrollWidth-title.clientWidth;
        if(distance>0){
          start??=now;
          const travel=distance/35*1000,pause=900,cycle=2*(travel+pause),elapsed=(now-start)%cycle;
          title.scrollLeft=elapsed<pause?0:elapsed<pause+travel?(elapsed-pause)/travel*distance:elapsed<2*pause+travel?distance:distance*(1-(elapsed-2*pause-travel)/travel);
        }else {title.scrollLeft=0;start=undefined;}
      }
      frame=requestAnimationFrame(scrollName);
    }
    frame=requestAnimationFrame(scrollName);
    return()=>{cancelAnimationFrame(frame);if(previous)previous.scrollLeft=0;};
  },[hovered,entry.name]);
  const done=isDone(entry,checklistDate(entry));
  const images=entry.attachments.filter(isPreviewImage);
  const index=Math.max(0,images.findIndex(photo=>photo.id===photoId)),photo=images[index];
  return <article ref={cardRef} className={`pinned-card${entry.color?` item-colored board-${entry.color}`:''}`} aria-label={entry.name} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
    <header>{grip}<span className="pinned-header-spacer" aria-hidden="true"/><div className="thought-controls" role="group" aria-label={`Actions for ${entry.name}`}><div ref={colorPicker} className="board-color-picker pinned-color-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setColorOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setColorOpen(false);colorButton.current?.focus();}}}>
      <button ref={colorButton} type="button" className="board-color-swatch" aria-label={`Card color: ${entry.color||'default'}`} title="Change color" aria-expanded={colorOpen} onClick={()=>setColorOpen(open=>!open)}><span/></button>
      {colorOpen&&<div className="board-color-options" role="group" aria-label="Thought color">
        <button type="button" className="pinned-color-default" aria-pressed={!entry.color} onClick={()=>{onEntryChange(entry,{color:''});setColorOpen(false);colorButton.current?.focus();}}>Default</button>
        {boardColors.map(color=><button key={color} type="button" className={`board-color-swatch board-${color}`} aria-label={color} title={color} aria-pressed={entry.color===color} onClick={()=>{onEntryChange(entry,{color});setColorOpen(false);colorButton.current?.focus();}}><span/>{entry.color===color&&<b aria-hidden="true">{'\u2713'}</b>}</button>)}
      </div>}
    </div><LocationLinks where={entry.where}/>{entry.budgetType&&<button type="button" className="pinned-track-button budget-track-button" aria-label={`Track ${entry.budgetType}`} title={`Track ${entry.budgetType}`} onClick={()=>onTrack(entry)}><span aria-hidden="true">{'\u{1F4B8}'}</span></button>}<button type="button" className="pinned-edit-button" aria-label={`Edit ${entry.name}`} title="Edit thought" onClick={()=>onEdit(entry)}><span aria-hidden="true">{'\u270F\uFE0F'}</span></button><button type="button" className="pinned-unpin-button" aria-label={`Unpin ${entry.name}`} title="Unpin thought" onClick={()=>onUnpin(entry)}><span aria-hidden="true">{'\u{1F4CC}'}</span></button></div></header>
    <InlineText value={entry.name} label="Edit thought name" className="pinned-title" required onCommit={name=>onEntryChange(entry,{name})}/>
    {photo&&<div className="board-polaroid"><AttachmentImage key={photo.id} file={photo} entryId={entry.id} connection={connection} token={token} itemName={entry.name} note={entry.note} onRemove={()=>onEntryChange(entry,{attachments:entry.attachments.filter(file=>file.id!==photo.id)})}/>
      {images.length>1&&<div className="board-photo-navigation"><button type="button" aria-label={`Previous photo for ${entry.name}`} onClick={()=>setPhotoId(images[(index+images.length-1)%images.length].id)}>‹</button><span aria-live="polite">{index+1} / {images.length}</span><button type="button" aria-label={`Next photo for ${entry.name}`} onClick={()=>setPhotoId(images[(index+1)%images.length].id)}>›</button></div>}
    </div>}
    <InlineText value={entry.note} label={photo?'Edit photo caption':'Edit note'} placeholder={photo?'Add a caption…':'Add a note…'} className="pinned-note" multiline onCommit={note=>onEntryChange(entry,{note})}/>
    {entry.task&&<label className="pinned-task-toggle">
      <input type="checkbox" aria-label={`${done?'Reopen':'Complete'} ${entry.name}`} checked={done} onChange={event=>{
        try {
          if(event.target.checked)assertCanComplete(entry,entries);
          onEntryChange(entry,setTaskDone(entry,event.target.checked));
          setTaskError('');
        } catch(cause) { setTaskError(cause instanceof Error?cause.message:'Could not update task.'); }
      }}/>
      <span>{done?'Completed':'Mark complete'}</span>
    </label>}
    {taskError&&<p className="error" role="alert">{taskError}</p>}
    {!entry.list.length&&!listOpen&&<button type="button" className="board-add-list" onClick={()=>setListOpen(true)}>＋ List</button>}
    {(entry.list.length>0||listOpen)&&<Checklist entry={entry} entries={entries} editable inline onChange={updated=>onEntryChange(entry,updated)}/>}
    <footer className="board-tags">{entryTags(entry).map((tag,index)=><span className="board-tag" key={index}>{tag}</span>)}</footer>
  </article>;
}
function UnpinDialog({entry,onConfirm,onClose}:{entry:Entry;onConfirm:()=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
  const titleId=useId(),descriptionId=useId();
  useEffect(()=>{
    const element=dialog.current!;element.showModal();cancel.current?.focus();
    return()=>element.close();
  },[]);
  return createPortal(<dialog ref={dialog} className="completion-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="modal-head"><h2 id={titleId}>Unpin thought?</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>?</button></div>
    <div className="completion-body"><div className="completion-task"><strong>{entry.name}</strong></div><p id={descriptionId} className="completion-description">Remove this thought from Pinned? It will remain in Thoughts and on the Board.</p></div>
    <div className="completion-actions"><button ref={cancel} type="button" className="secondary" onClick={onClose}>Cancel</button><button type="button" className="primary" onClick={onConfirm}>Unpin</button></div>
  </dialog>,document.body);
}
export default function Pinned({entries,visible,connection,token,onEdit,onEntryChange,onReorder,onTrack}:{entries:Entry[];visible:Entry[];connection:Connection;token?:string;onEdit:(entry:Entry)=>void;onTrack:(entry:Entry)=>void;onEntryChange:(entry:Entry,patch:Partial<Entry>)=>void;onReorder:(entries:Entry[])=>void}) {
  const cards=pinnedEntries(visible),drag=useRef<string|null>(null);
  const [target,setTarget]=useState<string|null>(null),[announcement,setAnnouncement]=useState('');
  const [unpinId,setUnpinId]=useState<string|null>(null);
  const unpinTarget=entries.find(entry=>entry.id===unpinId&&entry.pin);
  function move(source:string,target:string){onReorder(reorderPinned(entries,source,target));setAnnouncement('Pinned thoughts reordered.');}
  return <section aria-label="Pinned thoughts"><span className="screen-reader-only" role="status">{announcement}</span>
    {!cards.length&&<p>{entries.some(entry=>entry.pin)?'No pinned thoughts match your filters.':'Add the Pin attribute to a thought to see it here.'}</p>}
    <div className="pinned-grid">{cards.map((entry,index)=><div key={entry.id} data-pinned-id={entry.id} className={`pinned-slot${target===entry.id?' is-drop-target':''}`}>

      <PinnedCard entry={entry} entries={entries} connection={connection} token={token} onEdit={onEdit} onEntryChange={onEntryChange} onTrack={onTrack} onUnpin={entry=>setUnpinId(entry.id)} grip={<span tabIndex={0} role="group" aria-roledescription="drag grip" className="pinned-drag-handle" title="Drag to reorder, or use arrow keys" aria-label={`Reorder ${entry.name}. Use arrow keys to move.`}
        onKeyDown={event=>{const offset=['ArrowLeft','ArrowUp'].includes(event.key)?-1:['ArrowRight','ArrowDown'].includes(event.key)?1:0;if(offset){event.preventDefault();const other=cards[index+offset];if(other)move(entry.id,other.id);}}}
        onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current=entry.id;}}
        onPointerMove={event=>{if(drag.current){const slot=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-pinned-id]');setTarget(slot?.dataset.pinnedId||null);}}}
        onPointerUp={event=>{const slot=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-pinned-id]');if(drag.current&&slot?.dataset.pinnedId)move(drag.current,slot.dataset.pinnedId);drag.current=null;setTarget(null);}}
        onPointerCancel={()=>{drag.current=null;setTarget(null);}} onLostPointerCapture={()=>{drag.current=null;setTarget(null);}}><span aria-hidden="true">{'\u283F'}</span></span>}/>
    </div>)}</div>
    {unpinTarget&&<UnpinDialog entry={unpinTarget} onClose={()=>setUnpinId(null)} onConfirm={()=>{
      onEntryChange(unpinTarget,{pin:false,pinOrder:-1});
      setAnnouncement(`${unpinTarget.name} unpinned.`);
      setUnpinId(null);
    }}/>}
  </section>;
}
