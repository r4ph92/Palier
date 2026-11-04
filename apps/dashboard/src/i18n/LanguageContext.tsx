import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en.ts';
import { fr, type Dictionary } from './fr.ts';

export type Language = 'fr' | 'en';

const STORAGE_KEY = 'palier.language';
const DICTIONARIES: Readonly<Record<Language, Dictionary>> = { fr, en };

interface LanguageState {
  readonly language: Language;
  readonly text: Dictionary;
  readonly setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);

// French is the default; the toggle's choice survives a reload. Storage can be blocked, so reads and writes may fail quietly.
function storedLanguage(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // The choice then lasts for this page only.
  }
}

export function LanguageProvider({ children }: { readonly children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(storedLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    storeLanguage(language);
  }, [language]);
  const state = useMemo(() => ({ language, text: DICTIONARIES[language], setLanguage: setLanguageState }), [language]);
  return <LanguageContext.Provider value={state}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  const state = useContext(LanguageContext);
  if (state === null) {
    throw new Error('useLanguage must be used inside LanguageProvider.');
  }
  return state;
}

export function useText(): Dictionary {
  return useLanguage().text;
}
