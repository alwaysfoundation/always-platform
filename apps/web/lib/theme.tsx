'use client';
import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'always.theme';

/** Runs before paint so a dark-mode reader never sees a white flash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    try { const t = localStorage.getItem(KEY); if (t === 'light' || t === 'dark') setTheme(t); } catch { /* storage unavailable */ }
  }, []);
  function choose(t: Theme) {
    setTheme(t);
    try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
    if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  }
  return [theme, choose];
}
