import type { SpotFlags } from '../../../src/domain/spots/spotCategories.ts';
import type { SpotState } from '../../../src/domain/spots/spotStates.ts';

export interface StoredDemoSpot {
  state: SpotState;
  needsCheck: boolean;
  readonly isEv?: boolean;
  readonly isAccessible?: boolean;
  readonly isOversize?: boolean;
}

const NO_FLAGS: SpotFlags = { isEv: false, isAccessible: false, isOversize: false };

// As the seed flags them, for the fakes that answer by the spot's reservation: A-5 electric, B-4 oversize, B-5 accessible.
const DEMO_FLAGS: Readonly<Record<string, SpotFlags>> = {
  'A-5': { ...NO_FLAGS, isEv: true },
  'B-4': { ...NO_FLAGS, isOversize: true },
  'B-5': { ...NO_FLAGS, isAccessible: true },
};

// A flag the case sets on the spot wins over the seed's.
export function demoSpotFlagsOf(number: string, spot: StoredDemoSpot): SpotFlags {
  const seeded = DEMO_FLAGS[number] ?? NO_FLAGS;
  return { isEv: spot.isEv ?? seeded.isEv, isAccessible: spot.isAccessible ?? seeded.isAccessible, isOversize: spot.isOversize ?? seeded.isOversize };
}

// Parking Démo, level P1, as the seed builds it: A-1 to A-5 in aisle A, B-1 to B-5 in aisle B, all free.
export function parkingDemoSpots(): Map<string, StoredDemoSpot> {
  const numbers = ['A', 'B'].flatMap((aisle) => [1, 2, 3, 4, 5].map((index) => `${aisle}-${String(index)}`));
  return new Map(numbers.map((number) => [number, { state: 'AVAILABLE', needsCheck: false }]));
}
