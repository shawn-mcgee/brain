import {useEffect,useState} from 'react';
import type {RefObject} from 'react';

export function useCardMarquee(cardRef:RefObject<HTMLElement|null>,selector:string,name:string) {
  const [hovered,setHovered]=useState(false);
  useEffect(()=>{
    if(!hovered||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let frame=0,start:number|undefined;
    let previous:HTMLButtonElement|null=null;
    function scrollName(now:number){
      const title=cardRef.current?.querySelector<HTMLButtonElement>(selector)||null;
      if(title!==previous){if(previous)previous.scrollLeft=0;previous=title;start=undefined;}
      if(title){
        const distance=title.scrollWidth-title.clientWidth;
        if(distance>0){
          start??=now;
          const travel=distance/35*1000,pause=900,cycle=2*(travel+pause),elapsed=(now-start)%cycle;
          title.scrollLeft=elapsed<pause?0:elapsed<pause+travel?(elapsed-pause)/travel*distance:elapsed<2*pause+travel?distance:distance*(1-(elapsed-2*pause-travel)/travel);
        }else {title.scrollLeft=0;start=undefined;}
      }
      frame=requestAnimationFrame(scrollName);
    }
    frame=requestAnimationFrame(scrollName);
    return()=>{cancelAnimationFrame(frame);if(previous)previous.scrollLeft=0;};
  },[hovered,name,cardRef,selector]);
  return {onMouseEnter:()=>setHovered(true),onMouseLeave:()=>setHovered(false)};
}
