import type { AssignedSpot, EntrySessionState, SpotCheckReason } from '@palier/shared-types';
import { spotFits } from '../allocation/chooseSpotFor.ts';
import type { SpotFlags } from '../spots/spotCategories.ts';
import type { SpotState } from '../spots/spotStates.ts';
import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';

// Trimmed, otherwise as typed, so an exact painted number wins over its canonical match (decision 020).
export interface SpotAnswer {
  readonly sessionId: string;
  readonly driverId: string;
  readonly spotNumber: string;
}

export type ParkedAnswerRefusal = 'not-found' | 'not-asked' | 'closed' | 'unknown-spot' | 'spot-taken' | 'spot-out-of-service' | 'spot-not-suitable' | 'lot-busy';

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

export interface SpotFacts {
  readonly id: string;
  readonly state: SpotState;
}

export type AnsweredSpotFacts = SpotFacts & SpotFlags;

export interface PlacementFacts {
  readonly sessionState: EntrySessionState;
  readonly needs: VehicleNeeds;
  readonly assignedSpot: SpotFacts;
  readonly answeredSpot: AnsweredSpotFacts;
}

// What a placement writes: the answered spot occupied, unless it is the presumed one still occupied; the presumed spot flagged
// to check when the car turns out to be elsewhere. A presumed spot moved out of OCCUPIED meanwhile (an operator freed it) is no
// longer the driver's: it is named like any other spot, and left unflagged when the car is elsewhere.
export interface SpotWrites {
  readonly occupiesAnswered: boolean;
  readonly flagsAssigned: boolean;
}

type PlacementRefusal = Extract<ParkedAnswerRefusal, 'spot-taken' | 'spot-out-of-service' | 'spot-not-suitable'>;

export type Placement =
  | { readonly outcome: 'refused'; readonly refusal: PlacementRefusal }
  | ({ readonly outcome: 'placed' } & SpotWrites);

type CorrectionReason = Extract<SpotCheckReason, 'WRONG_AISLE' | 'WRONG_SPOT'>;

// A car found elsewhere than its assigned spot: in the same aisle the driver only took another spot, in another aisle the walk was wrong.
export function correctionReasonOf(assignedAisleId: string, answeredAisleId: string): CorrectionReason {
  return assignedAisleId === answeredAisleId ? 'WRONG_SPOT' : 'WRONG_AISLE';
}

function isOwnAssignedSpot({ assignedSpot, answeredSpot }: PlacementFacts): boolean {
  return answeredSpot.id === assignedSpot.id;
}

// Taken wins over fitness; the own assigned spot was allocated to this vehicle, so it is never fit-checked (decision 020).
function answeredSpotRefusal(facts: PlacementFacts): PlacementRefusal | null {
  const decision = decideSpotAnswer(facts.answeredSpot.state);
  if (decision !== 'occupy') {
    return decision;
  }
  return isOwnAssignedSpot(facts) || spotFits(facts.needs, facts.answeredSpot) ? null : 'spot-not-suitable';
}

export function placementOf(facts: PlacementFacts): Placement {
  const { sessionState, assignedSpot, answeredSpot } = facts;
  const isPresumed = sessionState === 'PARKED_PRESUMED';
  const isAssigned = isOwnAssignedSpot(facts);
  if (isPresumed && isAssigned && answeredSpot.state === 'OCCUPIED') {
    return { outcome: 'placed', occupiesAnswered: false, flagsAssigned: false };
  }
  const refusal = answeredSpotRefusal(facts);
  if (refusal !== null) {
    return { outcome: 'refused', refusal };
  }
  return { outcome: 'placed', occupiesAnswered: true, flagsAssigned: isPresumed && !isAssigned && assignedSpot.state === 'OCCUPIED' };
}
