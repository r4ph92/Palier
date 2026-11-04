import type { SupportedLanguage } from './i18n';

const CENTS_PER_DOLLAR = 100;
const NO_BREAK_SPACE = '\u00A0';
const NARROW_NO_BREAK_SPACE = '\u202F';
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

// Written by hand like the clock time: Hermes' Intl on iOS does not follow the backlog's 9,75 $ / $9.75 convention.
export function formatMoney(cents: number, language: SupportedLanguage): string {
  const dollars = Math.floor(cents / CENTS_PER_DOLLAR);
  const remainder = String(cents % CENTS_PER_DOLLAR).padStart(2, '0');
  if (language === 'fr') {
    return `${String(dollars).replace(THOUSANDS, NARROW_NO_BREAK_SPACE)},${remainder}${NO_BREAK_SPACE}$`;
  }
  return `$${String(dollars).replace(THOUSANDS, ',')}.${remainder}`;
}
