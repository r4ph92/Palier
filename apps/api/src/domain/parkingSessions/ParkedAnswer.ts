import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import type { SpotState } from '../spots/spotStates.ts';

// The driver says where the car is: asked after walking away in another aisle, or correcting a presumed spot; spotNumber is trimmed, otherwise as typed.
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

// A session asked where it parked, or presumed parked, takes an answer; one that already answered keeps its spot (decision 021).
export function decideSessionAnswer(state: EntrySessionState): SessionAnswerDecision {
  if (state === 'PARKED_UNCONFIRMED' || state === 'PARKED_PRESUMED') {
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

export interface PlacementFacts {
  readonly sessionState: EntrySessionState;
  readonly assignedSpotId: string;
  readonly spotId: string;
  readonly spotState: SpotState;
}

// keep-presumed: the presumed spot was right; move-from-presumed: the car is elsewhere, and the presumed spot is flagged to check.
export type PlacementDecision = 'occupy' | 'keep-presumed' | 'move-from-presumed' | Extract<ParkedAnswerRefusal, 'spot-taken' | 'spot-out-of-service'>;

export function decidePlacement({ sessionState, assignedSpotId, spotId, spotState }: PlacementFacts): PlacementDecision {
  if (sessionState !== 'PARKED_PRESUMED') {
    return decideSpotAnswer(spotState);
  }
  if (spotId === assignedSpotId) {
    return 'keep-presumed';
  }
  const decision = decideSpotAnswer(spotState);
  return decision === 'occupy' ? 'move-from-presumed' : decision;
}
