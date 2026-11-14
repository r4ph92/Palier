import type { SpotState } from '../spots/spotStates.ts';

export interface SpotToClear {
  readonly state: SpotState;
  readonly needsCheck: boolean;
  readonly heldBySession: boolean;
}

export type ClearDecision = 'ALREADY_CLEAR' | 'CLEAR' | 'STILL_ASSIGNED';

// Only a free spot nothing holds is cleared: the car that flagged it may still be there until its session ends.
export function clearDecisionOf({ state, needsCheck, heldBySession }: SpotToClear): ClearDecision {
  if (!needsCheck) {
    return 'ALREADY_CLEAR';
  }
  return state === 'AVAILABLE' && !heldBySession ? 'CLEAR' : 'STILL_ASSIGNED';
}
