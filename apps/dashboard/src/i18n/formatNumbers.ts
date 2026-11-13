import type { Language } from './LanguageContext.tsx';

const COORDINATE_DIGITS = 6;

export function formatCount(count: number, language: Language): string {
  return new Intl.NumberFormat(language).format(count);
}

export function formatDegrees(degrees: number, language: Language): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: COORDINATE_DIGITS }).format(degrees);
}

// French Canada reads « 14 h 32 »; the product's French is the Quebec one.
export function formatClockTime(moment: Date, language: Language): string {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en', { hour: 'numeric', minute: '2-digit' }).format(moment);
}
