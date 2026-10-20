export type Theme='light'|'dark';
export const THEME_KEY='brain-theme';
export function preferredTheme(stored:string|null,systemDark:boolean):Theme {
  return stored==='light'||stored==='dark'?stored:systemDark?'dark':'light';
}
export function readTheme():Theme {
  let stored:string|null=null;
  try {stored=localStorage.getItem(THEME_KEY);} catch { /* Storage is optional. */ }
  return preferredTheme(stored,window.matchMedia('(prefers-color-scheme: dark)').matches);
}
export function applyTheme(theme:Theme):void {
  document.documentElement.dataset.theme=theme;
}
