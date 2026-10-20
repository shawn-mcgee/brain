import {useEffect,useId,useRef,useState} from 'react';

export default function SyncStatusButton({status,state}:{status:string;state:string}){
  const [pinned,setPinned]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const container=useRef<HTMLButtonElement>(null),id=useId();
  const expanded=pinned||hovered||focused;
  useEffect(()=>{
    if(!pinned)return;
    const dismiss=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setPinned(false);};
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[pinned]);
  return <>
    <button ref={container} type="button" className={`floating-sync-status ${state}${expanded?' is-expanded':''}`}
      aria-label={`Sync status: ${status}`} aria-expanded={expanded} aria-controls={id}
      onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(true);}}
      onPointerLeave={()=>setHovered(false)}
      onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setFocused(true);}}
      onBlur={()=>{setFocused(false);setPinned(false);}}
      onClick={()=>setPinned(value=>!value)}
      onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setPinned(false);setHovered(false);setFocused(false);}}}>
      <span className="status-dot" aria-hidden="true"/>
      <span id={id} className="sync-status-description" aria-hidden={!expanded}>{status}</span>
    </button>
    <span className="screen-reader-only" role="status">{status}</span>
  </>;
}
