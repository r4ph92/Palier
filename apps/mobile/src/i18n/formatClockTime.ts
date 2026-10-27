import type { SupportedLanguage } from './i18n';

const CLOCK_LOCALES: Record<SupportedLanguage, string> = {
  fr: 'fr-CA',
  en: 'en-US',
};

export function formatClockTime(moment: Date, language: SupportedLanguage): string {
  return new Intl.DateTimeFormat(CLOCK_LOCALES[language], { hour: 'numeric', minute: '2-digit' }).format(moment);
}
