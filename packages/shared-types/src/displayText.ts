export interface TextLength {
  readonly minimum: number;
  readonly maximum: number;
}

// Control, format and line-separator characters (NUL, zero-width spaces, bidi overrides, U+2028) are invisible, and Postgres refuses NUL in text.
const INVISIBLE_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

// Letters in Unicode that draw nothing: the Hangul fillers and the Braille blank.
const BLANK_LETTER = /[\u3164\u115F\u1160\uFFA0\u2800]/u;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// Text a person types and others read: a legal name, a lot name, an address.
// Counted in code points after trimming, so an emoji is one character, the way a person counts it.
// A lone surrogate is refused because Postgres would store it as U+FFFD, a text nobody typed.
export function isValidDisplayText(text: string, { minimum, maximum }: TextLength): boolean {
  const trimmedText = text.trim();
  const length = [...trimmedText].length;
  return (
    length >= minimum &&
    length <= maximum &&
    trimmedText.isWellFormed() &&
    !INVISIBLE_CHARACTER.test(trimmedText) &&
    !BLANK_LETTER.test(trimmedText) &&
    LETTER_OR_DIGIT.test(trimmedText)
  );
}

// Two codes that read the same are one code: compatibility forms folded and accents composed (NFKC, so "Ｐ1" is "P1"),
// any run of spaces, no-break ones too, as one plain space.
export function canonicalCodeOf(text: string): string {
  return text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}
