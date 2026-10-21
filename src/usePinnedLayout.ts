import {useLayoutEffect,useRef} from 'react';
import {masonryLayout} from './pinned-layout';

export function usePinnedLayout(order:string[]) {
  const ref=useRef<HTMLDivElement>(null);
  const orderKey=JSON.stringify(order);
  useLayoutEffect(()=>{
    const container=ref.current!;
    const slots=new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-pinned-id]')).map(slot=>[slot.dataset.pinnedId!,slot]));
    let frame=0;
    const layout=()=>{
      const width=container.clientWidth;
      if(!width)return;
      const ordered=(JSON.parse(orderKey) as string[]).map(id=>slots.get(id)).filter((slot):slot is HTMLElement=>!!slot);
      const {cardWidth}=masonryLayout([],width);
      for(const slot of ordered)slot.style.width=`${cardWidth}px`;
      const result=masonryLayout(ordered.map(slot=>slot.getBoundingClientRect().height),width);
      ordered.forEach((slot,index)=>{
        const {x,y}=result.positions[index];
        slot.style.transform=`translate(${x}px, ${y}px)`;
      });
      container.style.height=`${result.height}px`;
      container.dataset.ready='true';
    };
    layout();
    const observer=new ResizeObserver(()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(layout);
    });
    observer.observe(container);
    slots.forEach(slot=>observer.observe(slot));
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[orderKey]);
  return ref;
}
