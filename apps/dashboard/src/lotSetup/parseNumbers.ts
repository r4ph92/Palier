export type ParsedNumber = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly reason: 'empty' | 'invalid' };

const CENTS_PER_DOLLAR = 100;
// Dollars, spaces only between groups of three, then at most one decimal mark and two digits: "1 000,00", "18.5", "18".
const AMOUNT = /^(\d{1,3}(?:\s\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;
const DECIMAL = /^-?\d+(?:[.,]\d+)?$/;
const WHOLE_NUMBER = /^\d+$/;
// No g flag: one dollar sign comes off, leading or trailing, so "$18$" keeps one and is refused.
const ONE_DOLLAR_SIGN = /^\$\s*|\s*\$$/;
const SPACES = /\s/g;

const EMPTY: ParsedNumber = { ok: false, reason: 'empty' };
const INVALID: ParsedNumber = { ok: false, reason: 'invalid' };

// "18,00 $", "$18.00" and "1 000,00" (no-break spaces too) all read as cents, without floating point.
export function parseAmount(text: string): ParsedNumber {
  const unsigned = text.trim().replace(ONE_DOLLAR_SIGN, '');
  if (unsigned === '') {
    return EMPTY;
  }
  const match = AMOUNT.exec(unsigned);
  if (match === null) {
    return INVALID;
  }
  const [, dollars = '', decimals = ''] = match;
  return safeNumber(Number(dollars.replace(SPACES, '')) * CENTS_PER_DOLLAR + Number(decimals.padEnd(2, '0')));
}

// Degrees with a comma or a point as the decimal mark: "45,52", "-73.58".
export function parseDecimal(text: string): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') {
    return EMPTY;
  }
  return DECIMAL.test(trimmed) ? { ok: true, value: Number(trimmed.replace(',', '.')) } : INVALID;
}

export function parseWholeNumber(text: string): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') {
    return EMPTY;
  }
  return WHOLE_NUMBER.test(trimmed) ? safeNumber(Number(trimmed)) : INVALID;
}

function safeNumber(value: number): ParsedNumber {
  return Number.isSafeInteger(value) ? { ok: true, value } : INVALID;
}

export function numberOrNaN(parsed: ParsedNumber): number {
  return parsed.ok ? parsed.value : Number.NaN;
}
