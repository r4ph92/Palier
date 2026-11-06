import type { SpotState } from '../../../src/domain/spots/spotStates.ts';

export interface StoredDemoSpot {
  state: SpotState;
  needsCheck: boolean;
  readonly isEv?: boolean;
}

// Parking Démo, level P1, as the seed builds it: A-1 to A-5 in aisle A, B-1 to B-5 in aisle B, all free.
export function parkingDemoSpots(): Map<string, StoredDemoSpot> {
  const numbers = ['A', 'B'].flatMap((aisle) => [1, 2, 3, 4, 5].map((index) => `${aisle}-${String(index)}`));
  return new Map(numbers.map((number) => [number, { state: 'AVAILABLE', needsCheck: false }]));
}
