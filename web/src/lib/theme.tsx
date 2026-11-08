import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { msg } from './i18n';

/** What the reader chose; "system" follows the device, as iOS does. */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const themeLabels: Record<ThemeChoice, string> = {
  system: msg('Match device'),
  light: msg('Light'),
  dark: msg('Dark'),
};

// index.html reads the same key before the first paint, so the page never flashes the wrong theme.
const STORAGE_KEY = 'vayora.theme';

function stored(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

const darkQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null);

interface ThemeContextValue {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ choice: 'system', setChoice: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(stored);

  useEffect(() => {
    const query = darkQuery();
    const apply = () => {
      const dark = choice === 'dark' || (choice === 'system' && Boolean(query?.matches));
      const root = document.documentElement;
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', dark ? '#0b1220' : '#f5f7f9'));
    };
    apply();
    if (choice !== 'system' || !query) return undefined;
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice simply will not survive a reload.
    }
    setChoiceState(next);
  }, []);

  return <ThemeContext.Provider value={{ choice, setChoice }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
