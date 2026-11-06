import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import type { SpotState } from '../spots/spotStates.ts';

// Trimmed, otherwise as typed, so an exact painted number wins over its canonical match (decision 020).
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
  readonly answeredSpot: { readonly id: string; readonly state: SpotState };
}

// What a placement writes: the answered spot occupied, unless it is the presumed one still occupied; the presumed spot flagged
// to check when the car turns out to be elsewhere. A presumed spot moved out of OCCUPIED meanwhile is named like any other spot.
export type Placement =
  | { readonly outcome: 'refused'; readonly refusal: Extract<ParkedAnswerRefusal, 'spot-taken' | 'spot-out-of-service'> }
  | { readonly outcome: 'placed'; readonly occupiesAnswered: boolean; readonly flagsAssigned: boolean };

export function placementOf({ sessionState, assignedSpotId, answeredSpot }: PlacementFacts): Placement {
  const isPresumed = sessionState === 'PARKED_PRESUMED';
  const isAssigned = answeredSpot.id === assignedSpotId;
  if (isPresumed && isAssigned && answeredSpot.state === 'OCCUPIED') {
    return { outcome: 'placed', occupiesAnswered: false, flagsAssigned: false };
  }
  const decision = decideSpotAnswer(answeredSpot.state);
  if (decision !== 'occupy') {
    return { outcome: 'refused', refusal: decision };
  }
  return { outcome: 'placed', occupiesAnswered: true, flagsAssigned: isPresumed && !isAssigned };
}
