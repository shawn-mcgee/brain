import {useEffect,useRef,useState} from 'react';

export default function ThoughtPinButton({name,pinned,disabled,onToggle}:{name:string;pinned:boolean;disabled:boolean;onToggle:()=>boolean}) {
  const [feedback,setFeedback]=useState<'pinned'|'unpinned'|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  return <button type="button" className="thought-pin-button" data-feedback={feedback||undefined}
    aria-label={`${pinned?'Unpin':'Pin'} ${name}`} title={pinned?'Unpin thought':'Pin thought'} aria-pressed={pinned} disabled={disabled}
    onClick={()=>{
      if(!onToggle())return;
      if(timer.current)clearTimeout(timer.current);
      setFeedback(pinned?'unpinned':'pinned');
      timer.current=setTimeout(()=>setFeedback(null),800);
    }}>
    <span className="thought-pin-icon" aria-hidden="true">{'\u{1F4CC}'}</span>
  </button>;
}
