import type { Language } from './LanguageContext.tsx';

const COORDINATE_DIGITS = 6;

export function formatCount(count: number, language: Language): string {
  return new Intl.NumberFormat(language).format(count);
}

// One decimal, then the unit after a no-break space: « 9,0 s » in French, "9.0 s" in English.
export function formatSeconds(seconds: number, language: Language): string {
  const figure = new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(seconds);
  return `${figure}\u00a0s`;
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

export function formatPercent(percent: number, language: Language): string {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(percent / 100);
}

// « 12 novembre » in French, "Nov 12" in English: enough to tell another day from today.
export function formatDayAndMonth(moment: Date, language: Language): string {
  const options: Intl.DateTimeFormatOptions = language === 'fr' ? { day: 'numeric', month: 'long' } : { month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en', options).format(moment);
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

// A YYYY-MM-DD day, as the operator entered it: read at noon UTC so no time zone moves it to the day before.
export function formatCalendarDay(day: string, language: Language): string {
  return new Intl.DateTimeFormat(dateLocaleOf(language), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

// The seconds tell two steps of one visit apart, which a gate writes a few seconds from each other.
export function formatClockTimeWithSeconds(moment: Date, language: Language): string {
  return new Intl.DateTimeFormat(dateLocaleOf(language), { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(moment);
}
