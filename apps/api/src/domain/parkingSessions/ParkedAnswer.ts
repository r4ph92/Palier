import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import type { SpotState } from '../spots/spotStates.ts';

// The driver walked away in another aisle and says where the car is; spotNumber is already normalized.
export interface SpotAnswer {
  readonly sessionId: string;
  readonly driverId: string;
  readonly spotNumber: string;
}

export type ParkedAnswerRefusal = 'not-found' | 'not-asked' | 'closed' | 'unknown-spot' | 'spot-taken' | 'spot-out-of-service' | 'lot-busy';

// confirmed: this answer placed the car; already: an earlier answer did, and its spot stands.
export type ParkedAnswer = { readonly outcome: 'confirmed' | 'already'; readonly spot: AssignedSpot } | { readonly outcome: ParkedAnswerRefusal };

export interface ParkedAnswerRepository {
  // The driver's own session only: another driver's session is not found, like an unknown id.
  answer(answer: SpotAnswer): Promise<ParkedAnswer>;
}

export type SessionAnswerDecision = 'take-spot' | 'already' | Extract<ParkedAnswerRefusal, 'not-asked' | 'closed'>;

// Only a session waiting for the question takes an answer; one that already answered keeps its spot.
export function decideSessionAnswer(state: EntrySessionState): SessionAnswerDecision {
  if (state === 'PARKED_UNCONFIRMED') {
    return 'take-spot';
  }
  if (state === 'PARKED_CONFIRMED') {
    return 'already';
  }
  return state === 'CANCELLED' ? 'closed' : 'not-asked';
}

export type SpotAnswerDecision = 'occupy' | Extract<ParkedAnswerRefusal, 'spot-taken' | 'spot-out-of-service'>;

// D9: a free spot, or one whose own driver walked away elsewhere (OCCUPIED_UNKNOWN, the driver's own assigned spot included),
// can hold the car; a spot assigned, held or occupied for someone else cannot.
const SPOT_ANSWER_DECISIONS: Readonly<Record<SpotState, SpotAnswerDecision>> = {
  AVAILABLE: 'occupy',
  OCCUPIED_UNKNOWN: 'occupy',
  ASSIGNED: 'spot-taken',
  HELD: 'spot-taken',
  OCCUPIED: 'spot-taken',
  OUT_OF_SERVICE: 'spot-out-of-service',
};

export function decideSpotAnswer(state: SpotState): SpotAnswerDecision {
  return SPOT_ANSWER_DECISIONS[state];
}
