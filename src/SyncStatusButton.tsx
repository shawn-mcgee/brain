import {useEffect,useId,useRef,useState} from 'react';

export default function SyncStatusButton({status,state}:{status:string;state:string}){
  const [open,setOpen]=useState(false),container=useRef<HTMLDivElement>(null);
  const id=useId();
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);
  },[open]);
  return <div ref={container} className="mobile-sync-control" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}}>
    <button type="button" className={`mobile-sync-status ${state}`} aria-label="Show sync status" aria-expanded={open} aria-controls={id} title={status} onClick={()=>setOpen(value=>!value)}><span className="status-dot" aria-hidden="true"/></button>
    {open&&<div id={id} className="mobile-sync-popover" role="status">{status}</div>}
  </div>;
}
