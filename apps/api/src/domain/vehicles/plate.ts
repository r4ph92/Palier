const MAX_PLATE_LENGTH = 8;
// Checked before upper-casing: toUpperCase() turns some non-ASCII letters into ASCII ones (ſ to S, ß to SS).
const PLATE_PATTERN = /^[A-Za-z0-9 -]+$/;

export interface PlateEntry {
  readonly plate: string;
  readonly plateKey: string;
}

// Shown upper-case as the driver typed it; matched without spaces or hyphens, so "abc 123", "ABC123" and "ABC-123" are the same plate.
export function readPlate(input: string): PlateEntry | null {
  const trimmed = input.trim();
  if (trimmed.length > MAX_PLATE_LENGTH || !PLATE_PATTERN.test(trimmed)) {
    return null;
  }
  const plate = trimmed.toUpperCase();
  const plateKey = plate.replace(/[ -]/g, '');
  // A plate of only spaces and hyphens has no letter or digit to match on.
  return plateKey === '' ? null : { plate, plateKey };
}
