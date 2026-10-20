import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export default function ImagePreview({source,name,itemName,note='',onClose}:{source:string;name:string;itemName?:string;note?:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null);
  const image=useRef<HTMLImageElement>(null);
  const drag=useRef<{id:number;x:number;y:number}|null>(null);
  const [view,setView]=useState({x:0,y:0,scale:1}),[loaded,setLoaded]=useState(false);
  function fit(){
    const area=viewport.current,picture=image.current;
    if(!area||!picture?.naturalWidth)return;
    const scale=Math.min(1,(area.clientWidth-24)/picture.naturalWidth,(area.clientHeight-24)/picture.naturalHeight);
    setView({scale,x:(area.clientWidth-picture.naturalWidth*scale)/2,y:(area.clientHeight-picture.naturalHeight*scale)/2});
  }
  function zoom(factor:number,point?:{x:number;y:number}){
    const area=viewport.current;if(!area)return;
    const anchor=point||{x:area.clientWidth/2,y:area.clientHeight/2};
    setView(previous=>{
      const scale=Math.max(.02,Math.min(8,previous.scale*factor)),ratio=scale/previous.scale;
      return {scale,x:anchor.x-(anchor.x-previous.x)*ratio,y:anchor.y-(anchor.y-previous.y)*ratio};
    });
  }
  useEffect(()=>{const element=dialog.current;const previous=document.activeElement; element?.showModal();return()=>{element?.close();if(previous instanceof HTMLElement)previous.focus();};},[]);
  useEffect(()=>{
    const area=viewport.current;if(!area)return;
    function wheel(event:WheelEvent){event.preventDefault();event.stopPropagation();const rect=area!.getBoundingClientRect();zoom(Math.exp(-Math.max(-80,Math.min(80,event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?area!.clientHeight:1)))*.01),{x:event.clientX-rect.left,y:event.clientY-rect.top});}
    area.addEventListener('wheel',wheel,{passive:false});return()=>area.removeEventListener('wheel',wheel);
  },[]);
  // Portals still bubble through the React tree, including the board's gestures.
  return createPortal(<dialog ref={dialog} className="image-preview" aria-label={`Image preview: ${itemName || name}`}
    onPointerDown={event=>event.stopPropagation()} onPointerMove={event=>event.stopPropagation()}
    onPointerUp={event=>event.stopPropagation()} onPointerCancel={event=>event.stopPropagation()}
    onLostPointerCapture={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}
    onKeyDown={event=>event.stopPropagation()} onKeyUp={event=>event.stopPropagation()}
    onDoubleClick={event=>event.stopPropagation()}
    onCancel={event=>{event.stopPropagation();onClose();}}
    onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget)onClose();}}>
    <div className="image-preview-header"><div className="image-preview-titles"><h2>{itemName || name}</h2><small>{name}</small></div><button type="button" autoFocus aria-label="Close image preview" onClick={onClose}>✕</button></div>
    <div className="image-preview-viewport" ref={viewport} tabIndex={0} aria-label="Image. Drag to pan; scroll to zoom. Arrow keys pan; plus and minus zoom."
      onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY};}}
      onPointerMove={event=>{const previous=drag.current;if(!previous||previous.id!==event.pointerId)return;const dx=event.clientX-previous.x,dy=event.clientY-previous.y;drag.current={id:event.pointerId,x:event.clientX,y:event.clientY};setView(old=>({...old,x:old.x+dx,y:old.y+dy}));}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
      onKeyDown={event=>{const moves:Record<string,[number,number]>={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(moves[event.key]){event.preventDefault();const [x,y]=moves[event.key];setView(old=>({...old,x:old.x+x,y:old.y+y}));}else if(['+','=','-'].includes(event.key)){event.preventDefault();zoom(event.key==='-'?1/1.25:1.25);}}}>
      <img ref={image} src={source} alt={name} draggable={false} onLoad={()=>{setLoaded(true);fit();}} style={{visibility:loaded?'visible':'hidden',transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}/>
    </div>
    {note.trim()&&<div className="image-preview-note" tabIndex={0} aria-label="Thought note">{note}</div>}
    <div className="image-preview-controls"><button type="button" aria-label="Zoom out" onClick={()=>zoom(1/1.25)}>−</button><output aria-label="Zoom">{Math.round(view.scale*100)}%</output><button type="button" aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button><button type="button" onClick={fit}>Fit</button><button type="button" onClick={()=>{const area=viewport.current,picture=image.current;if(area&&picture)setView({scale:1,x:(area.clientWidth-picture.naturalWidth)/2,y:(area.clientHeight-picture.naturalHeight)/2});}}>100%</button></div>
  </dialog>,document.body);
}
