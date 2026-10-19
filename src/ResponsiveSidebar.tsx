import {useEffect,useId,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';

export default function ResponsiveSidebar({children,mobileHeader}:{children:ReactNode;mobileHeader:ReactNode}){
  const [open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null);
  const id=useId();
  useEffect(()=>{
    const desktop=window.matchMedia('(min-width: 801px)');
    const resize=()=>{if(desktop.matches)setOpen(false);};
    desktop.addEventListener('change',resize);return()=>desktop.removeEventListener('change',resize);
  },[]);
  useEffect(()=>{
    const element=dialog.current;if(!open||!element)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    element.showModal();element.querySelector<HTMLElement>('nav button.active')?.focus();
    return()=>{element.close();document.body.style.overflow=previousOverflow;};
  },[open]);
  return <>
    <aside className="sidebar desktop-sidebar">{children}</aside>
    <header className="mobile-navigation"><button type="button" className="mobile-menu-button" aria-label="Open navigation menu" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(true)}><span aria-hidden="true">☰</span></button>{mobileHeader}</header>
    {createPortal(<dialog ref={dialog} id={id} className="mobile-sidebar-drawer" aria-label="Navigation menu" onCancel={event=>{event.preventDefault();setOpen(false);}} onClose={()=>setOpen(false)} onClick={event=>{
      const target=event.target as Element;
      if(target===event.currentTarget||target.closest('nav button,.brand,.sidebar-bottom button'))setOpen(false);
    }}>
      <button type="button" className="drawer-close" aria-label="Close navigation menu" onClick={()=>setOpen(false)}>✕</button>
      <aside className="sidebar">{children}</aside>
    </dialog>,document.body)}
  </>;
}
