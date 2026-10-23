import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {budgetDrop,budgetDragOffsets} from './budget-drag';
import type {BudgetSlot} from './budget-drag';
import {moveItem} from './reorder-model';

type Gesture={source:string;slots:BudgetSlot[];scroller:HTMLElement;scrollTop:number;y:number;target:string;after:boolean};
export default function ReorderableItems<T>({items,itemKey,label,onChange,disabled=false,children}:{items:T[];itemKey:(item:T,index:number)=>string;label:(item:T,index:number)=>string;onChange?:(items:T[])=>void;disabled?:boolean;children:(item:T,index:number,grip:ReactNode)=>ReactNode}) {
  const container=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),frame=useRef(0);
  const before=useRef<Map<string,DOMRect>|null>(null);
  const [preview,setPreview]=useState<{source:string;slots:BudgetSlot[];target:string;after:boolean}|null>(null);
  const [announcement,setAnnouncement]=useState('');
  const keys=items.map(itemKey),enabled=!!onChange&&!disabled&&items.length>1;
  function rows(){return Array.from(container.current!.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node.dataset.reorderKey!==undefined);}
  function cancel(){cancelAnimationFrame(frame.current);gesture.current=null;setPreview(null);}
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  useEffect(()=>{if(!enabled){const cleanup=requestAnimationFrame(cancel);return()=>cancelAnimationFrame(cleanup);}},[enabled]);
  useLayoutEffect(()=>{
    const old=before.current;before.current=null;
    if(!old||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(const row of rows()){
      const previous=old.get(row.dataset.reorderKey!),next=row.getBoundingClientRect();
      if(previous&&Math.abs(previous.top-next.top)>1)row.animate([{transform:`translateY(${previous.top-next.top}px)`},{transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
    }
  });
  function updatePreview(){
    const active=gesture.current;if(!active)return;
    const drop=budgetDrop(active.slots,active.y+active.scroller.scrollTop-active.scrollTop);
    if(drop&&(active.target!==drop.target||active.after!==drop.after)){
      Object.assign(active,drop);setPreview({source:active.source,slots:active.slots,...drop});
    }
  }
  function scroll(){
    const active=gesture.current;if(!active)return;
    const bounds=active.scroller===document.scrollingElement?{top:0,bottom:window.innerHeight}:active.scroller.getBoundingClientRect();
    const speed=active.y<bounds.top+48?-12:active.y>bounds.bottom-48?12:0;
    if(speed){active.scroller.scrollTop+=speed;updatePreview();}
    frame.current=requestAnimationFrame(scroll);
  }
  const offsets=preview?budgetDragOffsets(preview.slots,{kind:'item',source:preview.source,target:preview.target,after:preview.after}):new Map<string,number>();
  return <div ref={container} className={`reorderable-items${preview?' is-reordering':''}`}>
    <span className="screen-reader-only" role="status">{announcement}</span>
    {items.map((item,index)=>{
      const key=keys[index],name=label(item,index);
      const grip=onChange?<span role="group" aria-roledescription="drag grip" tabIndex={enabled?0:-1} className="reorder-grip" aria-disabled={!enabled} aria-label={`Reorder ${name}. Use up or down arrow keys.`} title="Drag to reorder, or use up/down arrows"
        onKeyDown={event=>{
          if(!enabled)return;
          if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel();return;}
          if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||gesture.current)return;
          event.preventDefault();event.stopPropagation();
          const to=event.key==='Home'?0:event.key==='End'?items.length-1:index+(event.key==='ArrowUp'?-1:1);
          if(to<0||to>=items.length||to===index)return;
          before.current=new Map(rows().map(row=>[row.dataset.reorderKey!,row.getBoundingClientRect()]));
          onChange(moveItem(items,index,to));setAnnouncement(`${name} moved to position ${to+1} of ${items.length}.`);
        }}
        onPointerDown={event=>{
          if(!enabled||event.button!==0)return;
          event.preventDefault();event.stopPropagation();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
          const slots=rows().map(row=>{const rect=row.getBoundingClientRect();return {id:row.dataset.reorderKey!,top:rect.top,height:rect.height};});
          let scroller:HTMLElement|null=container.current;
          while(scroller&&(!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)||scroller.scrollHeight<=scroller.clientHeight))scroller=scroller.parentElement;
          scroller=scroller||document.scrollingElement as HTMLElement;
          gesture.current={source:key,slots,scroller,scrollTop:scroller.scrollTop,y:event.clientY,target:key,after:false};
          setPreview({source:key,slots,target:key,after:false});frame.current=requestAnimationFrame(scroll);
        }}
        onPointerMove={event=>{if(gesture.current){event.stopPropagation();gesture.current.y=event.clientY;updatePreview();}}}
        onPointerUp={event=>{
          const active=gesture.current;if(!active)return;
          event.preventDefault();event.stopPropagation();
          const from=keys.indexOf(active.source),target=keys.indexOf(active.target);
          const to=target+(active.after?1:0)-(from<target+(active.after?1:0)?1:0);
          if(from>=0&&target>=0&&from!==to){onChange(moveItem(items,from,to));setAnnouncement(`${name} moved to position ${to+1} of ${items.length}.`);}
          cancel();
        }}
        onPointerCancel={cancel} onLostPointerCapture={cancel}><span aria-hidden="true">{'\u283F'}</span></span>:null;
      return <div key={key} data-reorder-key={key} className={`reorder-item${preview?.source===key?' is-dragging':''}`} style={{transform:`translateY(${offsets.get(key)||0}px)`,transition:preview?undefined:'none'}}>{children(item,index,grip)}</div>;
    })}
  </div>;
}
