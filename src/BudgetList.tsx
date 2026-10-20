import {useRef,useState} from 'react';
import type {DragEvent,KeyboardEvent,ReactNode} from 'react';
import type {Entry} from './domain';
import {budgetGroups} from './budget-order';
import type {BudgetMove} from './budget-order';
import BudgetProgress from './BudgetProgress';

type Drag={kind:'group'|'item';source:string;group?:string};
type Drop={kind:'group'|'item';target:string;after:boolean};
export default function BudgetList({entries,transactions,row,onMove}:{entries:Entry[];transactions:Entry[];row:(entry:Entry)=>ReactNode;onMove:(move:BudgetMove)=>void}) {
  const groups=budgetGroups(entries);
  const [drag,setDrag]=useState<Drag|null>(null),[drop,setDrop]=useState<Drop|null>(null);
  const activeDrag=useRef<Drag|null>(null);
  function clearDrag() {
    activeDrag.current=null;
    setDrag(null);setDrop(null);
  }
  function start(event:DragEvent,value:Drag) {
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',JSON.stringify(value));
    activeDrag.current=value;
    setDrag(value);setDrop(null);
  }
  function over(event:DragEvent,kind:Drag['kind'],target:string,group?:string) {
    const current=activeDrag.current;
    if(!current||current.kind!==kind||kind==='item'&&current.group!==group)return;
    event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
    const bounds=event.currentTarget.getBoundingClientRect();
    setDrop({kind,target,after:event.clientY>bounds.top+bounds.height/2});
  }
  function finish(event:DragEvent,kind:Drag['kind'],target:string,group?:string) {
    const current=activeDrag.current;
    if(!current||current.kind!==kind||kind==='item'&&current.group!==group)return;
    event.preventDefault();event.stopPropagation();
    const bounds=event.currentTarget.getBoundingClientRect();
    onMove({kind,source:current.source,target,after:event.clientY>bounds.top+bounds.height/2});
    clearDrag();
  }
  function keyboard(event:KeyboardEvent,kind:Drag['kind'],source:string,keys:string[]) {
    if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
    event.preventDefault();
    const direction=event.key==='ArrowUp'?-1:1,target=keys[keys.indexOf(source)+direction];
    if(target!==undefined)onMove({kind,source,target,after:direction>0});
  }
  const marker=(kind:Drag['kind'],target:string)=>drop?.kind===kind&&drop.target===target?` drop-${drop.after?'after':'before'}`:'';
  return <div className="budget-groups" onDragEnd={clearDrag}>
    <p className="budget-reorder-hint">Drag the handles to reorder groups or thoughts within a group. You can also focus a handle and use ↑ / ↓.</p>
    {groups.map(group=><section key={group.name} className={`budget-group${marker('group',group.name)}${drag?.kind==='group'&&drag.source===group.name?' is-dragging':''}`} aria-label={`${group.name||'Ungrouped'} budgets`} onDragOver={event=>over(event,'group',group.name)} onDrop={event=>finish(event,'group',group.name)}>
      <div className="budget-group-heading">
        <span className="budget-drag-handle" draggable tabIndex={0} role="group" aria-roledescription="drag grip" aria-label={`Reorder ${group.name||'Ungrouped'} group`} title="Drag to reorder group, or use arrow keys" onDragStart={event=>start(event,{kind:'group',source:group.name})} onKeyDown={event=>keyboard(event,'group',group.name,groups.map(item=>item.name))}><span aria-hidden="true">⠿</span></span>
        <h4>{group.name||'Ungrouped'} <span className="muted">· {group.entries.length}</span></h4>
      </div>
      <div className="entry-list">
        {group.entries.map(entry=><div key={entry.id} className={`budget-sortable-item${entry.color?` item-colored board-${entry.color}`:''}${marker('item',entry.id)}${drag?.kind==='item'&&drag.source===entry.id?' is-dragging':''}`} onDragOver={event=>over(event,'item',entry.id,group.name)} onDrop={event=>finish(event,'item',entry.id,group.name)}>
          <span className="budget-drag-handle budget-item-handle" draggable tabIndex={0} role="group" aria-roledescription="drag grip" aria-label={`Reorder ${entry.name}`} title="Drag within this group, or use arrow keys" onDragStart={event=>start(event,{kind:'item',source:entry.id,group:group.name})} onKeyDown={event=>keyboard(event,'item',entry.id,group.entries.map(item=>item.id))}><span aria-hidden="true">⠿</span></span>
          <div className="budget-sortable-content">{row(entry)}<BudgetProgress plan={entry} transactions={transactions}/></div>
        </div>)}
      </div>
    </section>)}
  </div>;
}
