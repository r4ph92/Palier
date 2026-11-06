import type { EntrySessionState } from '@palier/shared-types';

type ParkedState = 'PARKED_PRESUMED' | 'PARKED_CONFIRMED';
type WalkedAwayState = ParkedState | 'PARKED_UNCONFIRMED';

// The driver walked away from the car and Palier knows the spot: « Garé en A-1 » (Q36, story #21).
export function isParked(state: EntrySessionState): state is ParkedState {
  return state === 'PARKED_PRESUMED' || state === 'PARKED_CONFIRMED';
}

// The driver walked away from the car, wherever it is: the app no longer guides to the assigned spot.
export function hasWalkedAway(state: EntrySessionState): state is WalkedAwayState {
  return isParked(state) || state === 'PARKED_UNCONFIRMED';
}
