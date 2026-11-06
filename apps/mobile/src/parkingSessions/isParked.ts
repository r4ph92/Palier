import type { EntrySessionState } from '@palier/shared-types';

// The driver walked away from the car: the spot is taken and the app no longer guides to it (Q36).
export function isParked(state: EntrySessionState): state is 'PARKED_PRESUMED' {
  return state === 'PARKED_PRESUMED';
}
