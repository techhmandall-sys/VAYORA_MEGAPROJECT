// Translation. The English text is the key: `t('Find a ride')` shows that text in
// English and looks it up in a table for Hindi or Marathi. A string with no entry is
// shown in English, never blank, so a missing translation degrades instead of breaking.
//
// What is not translated: anything the server sends as prose (error explanations,
// notification messages) and anything a person typed (names, reviews, report details).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { distanceParts, durationParts, setFormatLanguage } from './format';

export type Language = 'en' | 'hi' | 'mr';

/** Each language named in itself, as a speaker would look for it. */
export const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'mr', name: 'मराठी' },
];

/**
 * The Hindi and Marathi tables. Each is fetched only when someone reads that language, so an
 * English reader downloads neither; until a table arrives, its language reads as English.
 */
export const TABLES: Partial<Record<Exclude<Language, 'en'>, Record<string, string>>> = {};

const LOADERS: Record<Exclude<Language, 'en'>, () => Promise<Record<string, string>>> = {
  hi: () => import('./locales/hi').then((module) => module.hi),
  mr: () => import('./locales/mr').then((module) => module.mr),
};

/** Fetches a language's table, once. Resolves when that language can be shown. */
export async function loadLanguage(language: Language): Promise<void> {
  if (language === 'en' || TABLES[language]) return;
  TABLES[language] = await LOADERS[language]();
}

const STORAGE_KEY = 'vayora.language';

export type Translate = (text: string, values?: Record<string, string | number>) => string;

/**
 * Marks a string for translation where no hook can be used, such as a validation schema
 * or a table of labels. Returns it unchanged; whoever displays it passes it through `t`.
 */
export const msg = (text: string): string => text;

export function translate(language: Language, text: string, values?: Record<string, string | number>): string {
  const template = language === 'en' ? text : (TABLES[language]?.[text] ?? text);
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

// English with a no-op setter, so a component rendered outside a provider still works.
const LanguageContext = createContext<LanguageContextValue>({ language: 'en', setLanguage: () => {} });

/** The language chosen on this device before, or English. */
export function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'hi' || value === 'mr' ? value : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const first = initial ?? storedLanguage();
    // Before the first render, so the first dates and prices are already in the language.
    setFormatLanguage(first);
    return first;
  });

  // Switches once the table is here, so the screen never shows half of each language.
  const setLanguage = useCallback((next: Language) => {
    loadLanguage(next).then(
      () => {
        setFormatLanguage(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // The choice simply will not survive a reload.
        }
        setLanguageState(next);
      },
      () => {
        // Offline with the table never fetched: it stays in the language it was in.
      },
    );
  }, []);

  // Tells browsers and screen readers what language the page is in.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export function useT(): Translate {
  const { language } = useContext(LanguageContext);
  return useCallback((text, values) => translate(language, text, values), [language]);
}

/** Distances and durations with their units in the reader's language. */
export function useUnits(): { distance: (metres: number) => string; duration: (minutes: number) => string } {
  const t = useT();
  return useMemo(
    () => ({
      distance: (metres) => {
        const { value, unit } = distanceParts(metres);
        return unit === 'm' ? t('{n} m', { n: value }) : t('{n} km', { n: value });
      },
      duration: (total) => {
        const { hours, minutes } = durationParts(total);
        if (hours === 0) return t('{m} min', { m: minutes });
        if (minutes === 0) return t('{h} h', { h: hours });
        return t('{h} h {m} min', { h: hours, m: minutes });
      },
    }),
    [t],
  );
}
