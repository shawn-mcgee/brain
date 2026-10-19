import {useEffect,useRef,useState} from 'react';
import type {ReactNode,MouseEvent,FocusEvent} from 'react';
export default function PersonalitySurface({as='article',className,children}:{as?:'article'|'div';className:string;children:ReactNode}) {
  const [relieved,setRelieved]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  function react(event:MouseEvent<HTMLElement>|FocusEvent<HTMLElement>,leaving:boolean) {
    const target=(event.target as Element).closest('.delete-button');
    if(!target||!event.currentTarget.contains(target)||target.contains(event.relatedTarget instanceof Node?event.relatedTarget:null))return;
    if(timer.current)clearTimeout(timer.current);
    setRelieved(leaving);
    if(leaving)timer.current=setTimeout(()=>setRelieved(false),1200);
  }
  const Tag=as;
  return <Tag className={`${className}${relieved?' is-relieved':''}`} onMouseOver={event=>react(event,false)} onMouseOut={event=>react(event,true)} onFocus={event=>react(event,false)} onBlur={event=>react(event,true)}>{children}<span className="relief-cue" aria-hidden="true">{'\u{1F62E}\u200D\u{1F4A8}'}</span></Tag>;
}
