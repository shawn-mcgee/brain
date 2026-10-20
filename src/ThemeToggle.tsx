import {useEffect,useState} from 'react';
import {applyTheme,readTheme,THEME_KEY} from './theme';

export default function ThemeToggle(){
  const [theme,setTheme]=useState(readTheme);
  useEffect(()=>applyTheme(theme),[theme]);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const systemChanged=()=>{
      try {const stored=localStorage.getItem(THEME_KEY);if(stored==='light'||stored==='dark')return;} catch { /* Use the system preference. */ }
      setTheme(readTheme());
    };
    const storageChanged=(event:StorageEvent)=>{if(event.key===THEME_KEY||event.key===null)setTheme(readTheme());};
    media.addEventListener('change',systemChanged);
    window.addEventListener('storage',storageChanged);
    return()=>{media.removeEventListener('change',systemChanged);window.removeEventListener('storage',storageChanged);};
  },[]);
  return <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={theme==='dark'} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={()=>{
    const next=theme==='dark'?'light':'dark';
    setTheme(next);applyTheme(next);
    try {localStorage.setItem(THEME_KEY,next);} catch { /* The toggle still works without storage. */ }
  }}><span aria-hidden="true">{theme==='dark'?'☀️':'🌙'}</span></button>;
}
