import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { extraHi, extraMr } from './locales';
import { hi } from './shared/hi';
import { mr } from './shared/mr';

// What the phone remembers: which VAYORA to talk to, and in which language.

export type Language = 'en' | 'hi' | 'mr';

export const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'mr', name: 'मराठी' },
];

// The web app's tables, so the same words read the same in both, and the few the app adds.
const TABLES: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  hi: { ...hi, ...extraHi },
  mr: { ...mr, ...extraMr },
};

export type Translate = (text: string, values?: Record<string, string | number>) => string;

export function translate(language: Language, text: string, values?: Record<string, string | number>): string {
  const template = language === 'en' ? text : (TABLES[language][text] ?? text);
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

/** "http://192.168.1.5:8080" from whatever was typed: a scheme added, a trailing slash dropped. */
export function normaliseUrl(value: string): string {
  const url = value.trim().replace(/\/+$/, '');
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

/**
 * The gateway beside a core-api address. Running locally, core-api answers on 8080 and the
 * gateway on 3000; online, one address serves both through the edge.
 */
export function gatewayUrlFor(apiUrl: string): string {
  return /:8080$/.test(apiUrl) ? apiUrl.replace(/:8080$/, ':3000') : apiUrl;
}

/** In Expo Go the app came from the laptop running VAYORA, so that laptop is the likely server. */
function guessApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8080` : '';
}

interface SettingsValue {
  ready: boolean;
  apiUrl: string;
  language: Language;
  setApiUrl: (url: string) => void;
  setLanguage: (language: Language) => void;
  t: Translate;
}

const STORAGE_KEY = 'vayora.settings';
const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [apiUrl, setApiUrlState] = useState('');
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        const saved = stored ? (JSON.parse(stored) as Partial<{ apiUrl: string; language: Language }>) : {};
        setApiUrlState(saved.apiUrl || guessApiUrl());
        if (saved.language === 'hi' || saved.language === 'mr' || saved.language === 'en') {
          setLanguageState(saved.language);
        }
      })
      .catch(() => setApiUrlState(guessApiUrl()))
      .finally(() => setReady(true));
  }, []);

  const save = useCallback((next: { apiUrl: string; language: Language }) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const setApiUrl = useCallback(
    (url: string) => {
      const next = normaliseUrl(url);
      setApiUrlState(next);
      save({ apiUrl: next, language });
    },
    [language, save],
  );

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      save({ apiUrl, language: next });
    },
    [apiUrl, save],
  );

  const t = useCallback<Translate>((text, values) => translate(language, text, values), [language]);

  const value = useMemo(
    () => ({ ready, apiUrl, language, setApiUrl, setLanguage, t }),
    [ready, apiUrl, language, setApiUrl, setLanguage, t],
  );
  return <SettingsContext.Provider value={value}>{ready ? children : null}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings outside SettingsProvider');
  return value;
}

export const useT = (): Translate => useSettings().t;
