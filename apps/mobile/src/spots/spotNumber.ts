import type { AssignedSpot } from '@palier/shared-types';

// After the hyphen of a spot number, so « A-1 » never splits across two lines; it is invisible and not spoken.
export const WORD_JOINER = '\u2060';

export function unbrokenSpotNumber(spot: AssignedSpot): string {
  return unbrokenNumber(spot.number);
}

export function unbrokenNumber(spotNumber: string): string {
  return spotNumber.replaceAll('-', `-${WORD_JOINER}`);
}
