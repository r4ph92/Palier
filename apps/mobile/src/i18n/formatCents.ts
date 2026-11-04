import type { SupportedLanguage } from './i18n';

const CENTS_PER_DOLLAR = 100;
const NO_BREAK_SPACE = ' ';

// Written by hand like the clock time, so the French amount reads 25,00 $ whatever Hermes's Intl does.
export function formatCents(cents: number, language: SupportedLanguage): string {
  const dollars = Math.floor(cents / CENTS_PER_DOLLAR);
  const remainder = String(cents % CENTS_PER_DOLLAR).padStart(2, '0');
  return language === 'fr' ? `${dollars},${remainder}${NO_BREAK_SPACE}$` : `$${dollars}.${remainder}`;
}
