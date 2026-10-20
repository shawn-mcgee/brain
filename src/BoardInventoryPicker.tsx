import {Fragment,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Entry} from './domain';
import {entryTags} from './board-tags';
import {filterInventory,isOnBoard} from './inventory-picker-model';
import type {InventoryFilters} from './inventory-picker-model';

export default function BoardInventoryPicker({entries,onPin,onClose}:{entries:Entry[];onPin:(entry:Entry)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const searchInput=useRef<HTMLInputElement>(null);
  const [filters,setFilters]=useState<InventoryFilters>({search:'',person:'',group:'',type:'',status:''});
  const [announcement,setAnnouncement]=useState('');
  const people=[...new Set(entries.flatMap(entry=>entry.who))].sort(),groups=[...new Set(entries.map(entry=>entry.group).filter(Boolean))].sort();
  const visible=filterInventory(entries,filters);
  useEffect(()=>{const element=dialog.current;element?.showModal();searchInput.current?.focus();return()=>element?.close();},[]);
  function update(patch:Partial<InventoryFilters>){setFilters(current=>({...current,...patch}));}
  return createPortal(<dialog ref={dialog} className="board-inventory-picker" aria-labelledby="board-inventory-title" onCancel={event=>{event.preventDefault();onClose();}}
    onPointerDown={event=>event.stopPropagation()} onPointerMove={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onPointerCancel={event=>event.stopPropagation()}
    onKeyDown={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget)onClose();}}>
    <div className="inventory-picker-header"><h2 id="board-inventory-title">Add existing thought</h2><button type="button" aria-label="Close thoughts" onClick={onClose}>✕</button></div>
    <div className="inventory-picker-filters">
      <input ref={searchInput} autoFocus type="search" aria-label="Search thoughts" placeholder="Find a thought…" value={filters.search} onChange={event=>update({search:event.target.value})}/>
      <div>
        <select aria-label="Filter by person" value={filters.person} onChange={event=>update({person:event.target.value})}><option value="">Everyone</option>{people.map(person=><option key={person}>{person}</option>)}</select>
        <select aria-label="Filter by group" value={filters.group} onChange={event=>update({group:event.target.value})}><option value="">All groups</option>{groups.map(group=><option key={group}>{group}</option>)}</select>
        <select aria-label="Filter by type" value={filters.type} onChange={event=>update({type:event.target.value})}><option value="">All types</option><option value="task">Tasks</option><option value="list">Lists</option><option value="photo">Photos</option><option value="money">Money</option><option value="note">Notes</option></select>
        <select aria-label="Filter by board status" value={filters.status} onChange={event=>update({status:event.target.value})}><option value="">All thoughts</option><option value="available">Available to add</option><option value="on-board">Already on board</option></select>
      </div>
    </div>
    <div className="inventory-picker-items" aria-label="All thoughts">
      {visible.map((entry,index)=>{const pinned=isOnBoard(entry);return <Fragment key={entry.id}>
        {pinned&&(index===0||!isOnBoard(visible[index-1]))&&<div className="inventory-picker-divider" role="separator" aria-label="Already on Board"><span>Already on Board</span></div>}
        <button type="button" className={`inventory-picker-row ${entry.color?`board-${entry.color} item-colored`:''}${pinned?' is-on-board':''}`} disabled={pinned} aria-label={pinned?`${entry.name} is already on the board`:`Add ${entry.name} to board`} onClick={()=>{if(isOnBoard(entry))return;onPin(entry);setAnnouncement(`${entry.name} added to the board.`);}}>
        <span className="inventory-picker-description"><strong>{entry.name}</strong>{entry.note&&<span className="inventory-picker-note">{entry.note}</span>}<span className="board-tags">{entryTags(entry).map((tag,index)=><span key={index} className="board-tag">{tag}</span>)}</span></span>
      </button></Fragment>})}
      {!visible.length&&<p className="inventory-picker-empty">{entries.length?'No matching thoughts. Try changing your search or filters.':'No thoughts yet. Create a thought to add it here.'}</p>}
    </div>
    <div className="inventory-picker-footer"><span role="status">{announcement}</span><button type="button" onClick={onClose}>Done</button></div>
  </dialog>,document.body);
}
