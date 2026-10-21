import {useEffect,useId,useRef,useState} from 'react';

export default function SyncStatusButton({status,state,feedback=0}:{status:string;state:string;feedback?:number}){
  const [pinned,setPinned]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const container=useRef<HTMLDivElement>(null),id=useId();
  const expanded=pinned||hovered||focused;
  useEffect(()=>{
    if(!pinned)return;
    const dismiss=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setPinned(false);};
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[pinned]);
  return <div ref={container} className={`sync-status-control${expanded?' is-expanded':''}`}
    onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(true);}}
    onPointerLeave={()=>setHovered(false)}>
    <button type="button" className={`floating-sync-status ${state}`}
      aria-label={`Sync status: ${status}`} aria-expanded={expanded} aria-controls={id}
      onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setFocused(true);}}
      onBlur={()=>{setFocused(false);setPinned(false);}}
      onClick={()=>setPinned(value=>!value)}
      onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setPinned(false);setHovered(false);setFocused(false);}}}>
      <span id={id} className="sync-status-description" aria-hidden={!expanded}>{status}</span>
      <span className="sync-status-icon" aria-hidden="true">
        <span className="status-dot"/>
        <span className="sync-activity"/>
        {feedback>0&&<span key={feedback} className="sync-save-feedback"/>}
      </span>
    </button>
    <span className="screen-reader-only" role="status">{status}</span>
  </div>;
}
