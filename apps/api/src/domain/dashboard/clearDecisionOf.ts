import type { SpotState } from '../spots/spotStates.ts';
import type { SpotCheckRefusalReason } from './spotCheckMessages.ts';

export interface SpotToClear {
  readonly state: SpotState;
  readonly needsCheck: boolean;
  readonly heldBySession: boolean;
}

export type ClearDecision = 'ALREADY_CLEAR' | 'CLEAR' | SpotCheckRefusalReason;

// A held or assigned spot is promised to a driver even before a session names it.
const ATTRIBUTED_STATES: readonly SpotState[] = ['HELD', 'ASSIGNED'];

// Only a free spot nothing holds is cleared: the car that flagged it may still be there until its session ends.
// A spot that is not free with no session holding it (out of service, or occupied with no session) has nothing to wait for, so it gets its own refusal.
export function clearDecisionOf({ state, needsCheck, heldBySession }: SpotToClear): ClearDecision {
  if (!needsCheck) {
    return 'ALREADY_CLEAR';
  }
  if (heldBySession || ATTRIBUTED_STATES.includes(state)) {
    return 'SPOT_STILL_ASSIGNED';
  }
  return state === 'AVAILABLE' ? 'CLEAR' : 'SPOT_NOT_FREE';
}
