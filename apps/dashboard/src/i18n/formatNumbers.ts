import type { Language } from './LanguageContext.tsx';

const COORDINATE_DIGITS = 6;

export function formatCount(count: number, language: Language): string {
  return new Intl.NumberFormat(language).format(count);
}

export function formatDegrees(degrees: number, language: Language): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: COORDINATE_DIGITS }).format(degrees);
}
