// Number() alone would read 1e1, 0x5 or " 3" as numbers.
const WHOLE_NUMBER = /^\d+$/;

export function readPositiveWholeNumber(rawValue: string): number | null {
  const value = Number(rawValue);
  return WHOLE_NUMBER.test(rawValue) && value >= 1 ? value : null;
}
