import { CENTS_PER_DOLLAR } from '@palier/shared-types/money';
import type { Language } from '../i18n/LanguageContext.tsx';

export type ParsedNumber = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly reason: 'empty' | 'invalid' };

// Dollars, spaces only between groups of three, then at most one decimal mark and two digits: "1 000,00", "18.5", "18".
const AMOUNT = /^(\d{1,3}(?:\s\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;
// What English prints: commas between groups of three, and only a point for the decimals: "1,000.00".
// Only English reads a comma as a thousands mark, because in French "1,005" is a decimal with one digit too many.
const COMMA_GROUPED_AMOUNT = /^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/;
const DECIMAL = /^-?\d+(?:[.,]\d+)?$/;
const WHOLE_NUMBER = /^(?:\d{1,3}(?:\s\d{3})+|\d+)$/;
const COMMA_GROUPED_WHOLE_NUMBER = /^\d{1,3}(?:,\d{3})+$/;
// No g flag: one dollar sign comes off, leading or trailing, so "$18$" keeps one and is refused.
const ONE_DOLLAR_SIGN = /^\$\s*|\s*\$$/;
const GROUP_SEPARATORS = /[\s,]/g;

const EMPTY: ParsedNumber = { ok: false, reason: 'empty' };
const INVALID: ParsedNumber = { ok: false, reason: 'invalid' };

// "18,00 $", "$18.00", "1 000,00" (no-break spaces too) and, in English, "$1,000.00" all read as cents, without floating point.
export function parseAmount(text: string, language: Language): ParsedNumber {
  const unsigned = text.trim().replace(ONE_DOLLAR_SIGN, '');
  if (unsigned === '') {
    return EMPTY;
  }
  const match = (language === 'en' ? COMMA_GROUPED_AMOUNT.exec(unsigned) : null) ?? AMOUNT.exec(unsigned);
  if (match === null) {
    return INVALID;
  }
  const [, dollars = '', decimals = ''] = match;
  return safeNumber(Number(dollars.replace(GROUP_SEPARATORS, '')) * CENTS_PER_DOLLAR + Number(decimals.padEnd(2, '0')));
}

// Degrees with a comma or a point as the decimal mark: "45,52", "-73.58".
export function parseDecimal(text: string): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') {
    return EMPTY;
  }
  return DECIMAL.test(trimmed) ? { ok: true, value: Number(trimmed.replace(',', '.')) } : INVALID;
}

export function parseWholeNumber(text: string, language: Language): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') {
    return EMPTY;
  }
  return isWholeNumber(trimmed, language) ? safeNumber(Number(trimmed.replace(GROUP_SEPARATORS, ''))) : INVALID;
}

function isWholeNumber(text: string, language: Language): boolean {
  return WHOLE_NUMBER.test(text) || (language === 'en' && COMMA_GROUPED_WHOLE_NUMBER.test(text));
}

function safeNumber(value: number): ParsedNumber {
  return Number.isSafeInteger(value) ? { ok: true, value } : INVALID;
}

export function numberOrNaN(parsed: ParsedNumber): number {
  return parsed.ok ? parsed.value : Number.NaN;
}
