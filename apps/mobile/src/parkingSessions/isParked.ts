import type { EntrySessionState, WalkedAwayState } from '@palier/shared-types';
import { WALKED_AWAY_STATES } from '@palier/shared-types/entries';

type ParkedState = Exclude<WalkedAwayState, 'PARKED_UNCONFIRMED'>;

const WALKED_AWAY: readonly EntrySessionState[] = WALKED_AWAY_STATES;

// The driver walked away from the car and Palier knows the spot: « Garé en A-1 » (Q36, story #21).
export function isParked(state: EntrySessionState): state is ParkedState {
  return state === 'PARKED_PRESUMED' || state === 'PARKED_CONFIRMED';
}

// The driver walked away from the car, wherever it is: the app no longer guides to the assigned spot.
export function hasWalkedAway(state: EntrySessionState): state is WalkedAwayState {
  return WALKED_AWAY.includes(state);
}
