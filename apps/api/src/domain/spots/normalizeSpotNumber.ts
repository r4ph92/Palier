const SEPARATORS = /[\s–—-]+/g;
const LETTERS_THEN_DIGITS = /^([A-Z]+)(\d)/;

// What a driver types for the number painted on the ground: « b3 », « B 3 » and « B – 3 » all name « B-3 ».
export function normalizeSpotNumber(typed: string): string {
  return typed.trim().toUpperCase().replace(SEPARATORS, '-').replace(LETTERS_THEN_DIGITS, '$1-$2');
}
