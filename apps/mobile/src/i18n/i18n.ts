import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { en } from './en';
import { fr } from './fr';

export type SupportedLanguage = 'fr' | 'en';

const FRENCH_SINGULAR_LIMIT = 1;

export const i18n = new I18n({ fr, en });
i18n.defaultLocale = 'fr';
i18n.enableFallback = true;
i18n.pluralization.register('fr', (_i18n, count) => (count <= FRENCH_SINGULAR_LIMIT ? ['one'] : ['other']));
i18n.pluralization.register('en', (_i18n, count) => (count === 1 ? ['one'] : ['other']));

export function deviceLanguage(): SupportedLanguage {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'fr';
}

export function applyLanguage(language: SupportedLanguage): void {
  i18n.locale = language;
}
