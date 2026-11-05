import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { en } from './en';
import { fr } from './fr';

export type SupportedLanguage = 'fr' | 'en';

// French keeps the singular below 2: « 0 place libre », « 1,2 kilomètre ».
const FRENCH_PLURAL_FROM = 2;

export const i18n = new I18n({ fr, en });
i18n.defaultLocale = 'fr';
i18n.enableFallback = true;
i18n.pluralization.register('fr', (_i18n, count) => (count < FRENCH_PLURAL_FROM ? ['one'] : ['other']));
i18n.pluralization.register('en', (_i18n, count) => (count === 1 ? ['one'] : ['other']));

export function deviceLanguage(): SupportedLanguage {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'fr';
}

export function applyLanguage(language: SupportedLanguage): void {
  i18n.locale = language;
}

export function currentLanguage(): SupportedLanguage {
  return i18n.locale === 'en' ? 'en' : 'fr';
}
