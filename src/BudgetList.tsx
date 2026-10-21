import {useEffect,useRef,useState} from 'react';
import type {DragEvent,KeyboardEvent,ReactNode} from 'react';
import type {Entry} from './domain';
import {budgetGroups} from './budget-order';
import type {BudgetMove} from './budget-order';
import BudgetProgress from './BudgetProgress';
import InlineText from './InlineText';
import {budgetDrop,budgetDragOffsets} from './budget-drag';
import type {BudgetSlot} from './budget-drag';

type DragSource={kind:'group'|'item';source:string;group?:string};
type Drag=DragSource&{slots:BudgetSlot[];region?:{top:number;bottom:number}};
type Drop={kind:'group'|'item';target:string;after:boolean};
export default function BudgetList({entries,transactions,row,onMove,onRenameGroup}:{entries:Entry[];transactions:Entry[];row:(entry:Entry)=>ReactNode;onMove:(move:BudgetMove)=>void;onRenameGroup:(source:string,name:string)=>void}) {
  const groups=budgetGroups(entries);
  const [drag,setDrag]=useState<Drag|null>(null),[drop,setDrop]=useState<Drop|null>(null);
  const activeDrag=useRef<Drag|null>(null);
  const container=useRef<HTMLDivElement>(null);
  const settling=useRef<number>(0);
  useEffect(()=>()=>cancelAnimationFrame(settling.current),[]);
  function clearDrag() {
    activeDrag.current=null;
    setDrag(null);setDrop(null);
  }
  function start(event:DragEvent,value:DragSource) {
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',JSON.stringify(value));
    const parent=value.kind==='group'?container.current!:event.currentTarget.closest('.budget-group')!;
    const nodes=Array.from(parent.querySelectorAll<HTMLElement>(value.kind==='group'?'[data-budget-group]':'[data-budget-item]'));
    const slots=nodes.map(node=>{
      const bounds=node.getBoundingClientRect();
      return {id:(value.kind==='group'?node.dataset.budgetGroup:node.dataset.budgetItem)!,top:bounds.top+window.scrollY,height:bounds.height};
    });
    const bounds=parent.getBoundingClientRect();
    const next={...value,slots,region:value.kind==='item'?{top:bounds.top+window.scrollY,bottom:bounds.bottom+window.scrollY}:undefined};
    activeDrag.current=next;
    setDrag(next);setDrop(null);
  }
  function destination(event:DragEvent) {
    const current=activeDrag.current;
    const y=event.clientY+window.scrollY;
    if(!current||current.region&&(y<current.region.top||y>current.region.bottom))return null;
    const target=budgetDrop(current.slots,y);
    return target?{kind:current.kind,...target}:null;
  }
  function over(event:DragEvent) {
    const next=destination(event);
    if(next){event.preventDefault();event.dataTransfer.dropEffect='move';}
    setDrop(previous=>previous?.kind===next?.kind&&previous?.target===next?.target&&previous?.after===next?.after?previous:next);
  }
  function finish(event:DragEvent) {
    const next=destination(event),current=activeDrag.current;
    if(!next||!current){clearDrag();return;}
    event.preventDefault();
    // The saved DOM order takes over at the preview's exact visual positions.
    container.current!.classList.add('is-settling');
    cancelAnimationFrame(settling.current);
    onMove({...next,source:current.source});
    clearDrag();
    settling.current=requestAnimationFrame(()=>{
      if(container.current){void container.current.offsetHeight;container.current.classList.remove('is-settling');}
    });
  }
  function keyboard(event:KeyboardEvent,kind:Drag['kind'],source:string,keys:string[]) {
    if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
    event.preventDefault();
    const direction=event.key==='ArrowUp'?-1:1,target=keys[keys.indexOf(source)+direction];
    if(target!==undefined)onMove({kind,source,target,after:direction>0});
  }
  const offsets=drag&&drop?budgetDragOffsets(drag.slots,{...drop,source:drag.source}):new Map<string,number>();
  const previewStyle=(kind:Drag['kind'],id:string)=>({transform:drag?.kind===kind?`translateY(${offsets.get(id)||0}px)`:undefined});
  return <div ref={container} className="budget-groups" onDragEnd={clearDrag} onDragOver={over} onDrop={finish} onDragLeave={event=>{
    const bounds=event.currentTarget.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>=bounds.right||event.clientY<bounds.top||event.clientY>=bounds.bottom)setDrop(null);
  }}>
    <p className="budget-reorder-hint">Drag the handles to reorder groups or thoughts within a group. You can also focus a handle and use ↑ / ↓.</p>
    {groups.map(group=><section key={group.name} data-budget-group={group.name} style={previewStyle('group',group.name)} className={`budget-group${drag?.kind==='group'&&drag.source===group.name?' is-dragging':''}`} aria-label={`${group.name||'Ungrouped'} budgets`}>
      <div className="budget-group-heading">
        <span className="budget-drag-handle" draggable tabIndex={0} role="group" aria-roledescription="drag grip" aria-label={`Reorder ${group.name||'Ungrouped'} group`} title="Drag to reorder group, or use arrow keys" onDragStart={event=>start(event,{kind:'group',source:group.name})} onKeyDown={event=>keyboard(event,'group',group.name,groups.map(item=>item.name))}><span aria-hidden="true">⠿</span></span>
        <h4>{group.name?<InlineText value={group.name} label={`Rename group ${group.name}`} className="budget-group-name" onCommit={name=>onRenameGroup(group.name,name)}/>:'Ungrouped'} <span className="muted">· {group.entries.length}</span></h4>
      </div>
      <div className="entry-list">
        {group.entries.map(entry=><div key={entry.id} data-budget-item={entry.id} style={previewStyle('item',entry.id)} className={`budget-sortable-item${entry.color?` item-colored board-${entry.color}`:''}${drag?.kind==='item'&&drag.source===entry.id?' is-dragging':''}`}>
          <span className="budget-drag-handle budget-item-handle" draggable tabIndex={0} role="group" aria-roledescription="drag grip" aria-label={`Reorder ${entry.name}`} title="Drag within this group, or use arrow keys" onDragStart={event=>start(event,{kind:'item',source:entry.id,group:group.name})} onKeyDown={event=>keyboard(event,'item',entry.id,group.entries.map(item=>item.id))}><span aria-hidden="true">⠿</span></span>
          <div className="budget-sortable-content">{row(entry)}<BudgetProgress plan={entry} transactions={transactions}/></div>
        </div>)}
      </div>
    </section>)}
  </div>;
}
