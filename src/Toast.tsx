import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export default function Toast({message,onClose}:{message:string;onClose:()=>void}) {
  const [remaining,setRemaining]=useState(1),[paused,setPaused]=useState(false);
  const remainingRef=useRef(1),closeRef=useRef(onClose);
  useEffect(()=>{closeRef.current=onClose},[onClose]);
  useEffect(()=>{if(paused)return;const started=performance.now(),initial=remainingRef.current;const timer=window.setInterval(()=>{const next=Math.max(0,initial-(performance.now()-started)/6000);remainingRef.current=next;setRemaining(next);if(next===0)closeRef.current()},50);return()=>clearInterval(timer)},[paused]);
  return createPortal(<div className="banner success notification-toast" role="status" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}><span>{message}</span><button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onClose}><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" className="toast-ring-track"/><circle cx="20" cy="20" r="17" className="toast-ring" pathLength="1" strokeDasharray="1" strokeDashoffset={1-remaining}/><path className="toast-close-cross" d="M15 15L25 25M25 15L15 25"/></svg></button></div>,document.body);
}
