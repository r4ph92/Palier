// Keeps a figure with its unit (« 9,75 $ », « 18 h 02 ») on one line.
export const NO_BREAK_SPACE = '\u00A0';
// French thousands separator (« 1 234,56 $ »).
export const NARROW_NO_BREAK_SPACE = '\u202F';

export const CENTS_PER_DOLLAR = 100;

export type Language = 'fr' | 'en';

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

// Written by hand: Hermes' Intl on iOS does not follow the backlog's 9,75 $ / $9.75 convention.
export function formatMoney(cents: number, language: Language): string {
  const dollars = Math.floor(cents / CENTS_PER_DOLLAR);
  const remainder = String(cents % CENTS_PER_DOLLAR).padStart(2, '0');
  if (language === 'fr') {
    return `${String(dollars).replace(THOUSANDS, NARROW_NO_BREAK_SPACE)},${remainder}${NO_BREAK_SPACE}$`;
  }
  return `$${String(dollars).replace(THOUSANDS, ',')}.${remainder}`;
}
