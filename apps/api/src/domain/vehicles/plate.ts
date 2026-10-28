const MAX_PLATE_LENGTH = 8;
const PLATE_PATTERN = /^[A-Z0-9 -]+$/;

export interface PlateEntry {
  readonly plate: string;
  readonly plateKey: string;
}

// Shown upper-case as the driver typed it; matched without spaces, so "abc 123" and "ABC123" are the same plate.
export function readPlate(input: string): PlateEntry | null {
  const plate = input.trim().toUpperCase();
  if (plate.length > MAX_PLATE_LENGTH || !PLATE_PATTERN.test(plate)) {
    return null;
  }
  return { plate, plateKey: plate.replaceAll(' ', '') };
}
