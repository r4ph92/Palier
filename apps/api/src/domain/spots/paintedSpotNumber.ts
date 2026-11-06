import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';

// The painted number a typed one names: the exact one first, else the only one equal without case, spaces or dashes.
// Beside « B12 » and « B1-2 », « b12 » names neither, so the driver is asked for the number as painted.
export function paintedNumberNamed(paintedNumbers: readonly string[], typedNumber: string): string | undefined {
  if (paintedNumbers.includes(typedNumber)) {
    return typedNumber;
  }
  const typed = canonicalSpotNumber(typedNumber);
  const matches = paintedNumbers.filter((number) => canonicalSpotNumber(number) === typed);
  return matches.length === 1 ? matches[0] : undefined;
}
