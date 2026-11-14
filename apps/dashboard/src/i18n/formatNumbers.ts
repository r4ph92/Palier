import type { Language } from './LanguageContext.tsx';

const COORDINATE_DIGITS = 6;

export function formatCount(count: number, language: Language): string {
  return new Intl.NumberFormat(language).format(count);
}

export function formatDegrees(degrees: number, language: Language): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: COORDINATE_DIGITS }).format(degrees);
}

function dateLocaleOf(language: Language): string {
  return language === 'fr' ? 'fr-CA' : 'en';
}

// French Canada reads « 14 h 32 »; the product's French is the Quebec one.
export function formatClockTime(moment: Date, language: Language): string {
  return new Intl.DateTimeFormat(dateLocaleOf(language), { hour: 'numeric', minute: '2-digit' }).format(moment);
}

export function formatMetres(metres: number, language: Language): string {
  return new Intl.NumberFormat(language, { style: 'unit', unit: 'meter' }).format(metres);
}

// The year is left out for this year's moments: a flag is read the day it is raised, not years later.
export function formatRecentDateTime(moment: Date, language: Language, now: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  const wanted: Intl.DateTimeFormatOptions = moment.getFullYear() === now.getFullYear() ? options : { ...options, year: 'numeric' };
  return new Intl.DateTimeFormat(dateLocaleOf(language), wanted).format(moment);
}
