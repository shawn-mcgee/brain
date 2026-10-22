import {useEffect,useId,useRef,useState} from 'react';
import type {CSSProperties} from 'react';

export default function SyncStatusButton({status,state,feedback=0,onRefresh,refreshDisabled=false}:{status:string;state:string;feedback?:number;onRefresh:()=>void;refreshDisabled?:boolean}){
  const [pinned,setPinned]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const container=useRef<HTMLDivElement>(null),id=useId();
  const description=useRef<HTMLSpanElement>(null),text=useRef<HTMLSpanElement>(null);
  const [overflow,setOverflow]=useState(0);
  const expanded=pinned||hovered||focused;
  useEffect(()=>{
    const viewport=description.current,content=text.current;
    if(!viewport||!content||!expanded)return;
    const measure=()=>setOverflow(Math.max(0,content.scrollWidth-viewport.clientWidth));
    const observer=new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    measure();
    return()=>observer.disconnect();
  },[status,expanded]);
  useEffect(()=>{
    if(!pinned)return;
    const dismiss=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setPinned(false);};
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[pinned]);
  return <div ref={container} className={`sync-status-control${expanded?' is-expanded':''}`}
    onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setFocused(false);setPinned(false);}}}
    onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setPinned(false);setHovered(false);setFocused(false);}}}
    onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(true);}}
    onPointerLeave={()=>setHovered(false)}>
    <div className={`floating-sync-status ${state}`}>
    {expanded&&<button type="button" className="sync-status-refresh" aria-label="Refresh sync" title="Refresh sync" disabled={refreshDisabled} onClick={onRefresh}><span aria-hidden="true">🔄️</span></button>}
    <button type="button" className="sync-status-toggle"
      aria-label={`Sync status: ${status}`} aria-expanded={expanded} aria-controls={id}
      onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setFocused(true);}}
      onClick={()=>setPinned(value=>!value)}
      >
      <span ref={description} id={id} className="sync-status-description" aria-hidden={!expanded}>
        <span ref={text} key={status} className={`sync-status-text${expanded&&overflow>0?' is-overflowing':''}`} style={{'--sync-marquee-offset':`-${overflow}px`,'--sync-marquee-duration':`${Math.max(4,overflow/25+2)}s`} as CSSProperties}>{status}</span>
      </span>
      <span className="sync-status-icon" aria-hidden="true">
        <span className="status-dot"/>
        <span className="sync-activity"/>
        {feedback>0&&<span key={feedback} className="sync-save-feedback"/>}
      </span>
    </button>
    </div>
    <span className="screen-reader-only" role="status">{status}</span>
  </div>;
}
