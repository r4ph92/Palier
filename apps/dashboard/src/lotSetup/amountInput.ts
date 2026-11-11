import type { Language } from '../i18n/LanguageContext.tsx';

const CENTS_PER_DOLLAR = 100;
const DECIMAL_MARK: Readonly<Record<Language, string>> = { fr: ',', en: '.' };

// The amount as typed in the pricing form, "1,00" or "1.00", without the dollar sign or a thousands mark.
export function amountInputOf(cents: number, language: Language): string {
  const remainder = String(cents % CENTS_PER_DOLLAR).padStart(2, '0');
  return `${Math.floor(cents / CENTS_PER_DOLLAR)}${DECIMAL_MARK[language]}${remainder}`;
}
