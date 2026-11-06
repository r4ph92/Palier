import type { EntrySessionState, WalkedAwayState } from '@palier/shared-types';

type ParkedState = Exclude<WalkedAwayState, 'PARKED_UNCONFIRMED'>;

// The driver walked away from the car and Palier knows the spot: « Garé en A-1 » (Q36, story #21).
export function isParked(state: EntrySessionState): state is ParkedState {
  return state === 'PARKED_PRESUMED' || state === 'PARKED_CONFIRMED';
}
