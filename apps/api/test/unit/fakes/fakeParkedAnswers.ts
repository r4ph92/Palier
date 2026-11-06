import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import { paintedNumberNamed } from '../../../src/domain/spots/paintedSpotNumber.ts';
import {
  decideSessionAnswer,
  placementOf,
  type ParkedAnswer,
  type ParkedAnswerRepository,
  type SpotAnswer,
} from '../../../src/domain/parkingSessions/ParkedAnswer.ts';
import type { SpotState } from '../../../src/domain/spots/spotStates.ts';

export interface StoredAnsweringSession {
  readonly driverId: string;
  readonly assignedSpotNumber: string;
  state: EntrySessionState;
  confirmedSpotNumber: string | null;
  answeredAt: Date | null;
}

export interface StoredSpot {
  state: SpotState;
  needsCheck: boolean;
}

// Parking Démo, level P1, as the seed builds it: A-1 to A-5 in aisle A, B-1 to B-5 in aisle B.
function parkingDemoSpots(): Map<string, StoredSpot> {
  const numbers = ['A', 'B'].flatMap((aisle) => [1, 2, 3, 4, 5].map((index) => `${aisle}-${String(index)}`));
  return new Map(numbers.map((number) => [number, { state: 'AVAILABLE', needsCheck: false }]));
}

// Mirrors PostgresParkedAnswerRepository over one lot; its SQL is checked on the lane database (docs/decisions/002).
export class FakeParkedAnswers implements ParkedAnswerRepository {
  writes = 0;
  isLotBusy = false;
  readonly answeredNumbers: string[] = [];
  readonly #sessions = new Map<string, StoredAnsweringSession>();
  readonly #spots = parkingDemoSpots();

  add(sessionId: string, session: StoredAnsweringSession): void {
    this.#sessions.set(sessionId, { ...session });
  }

  setSpot(number: string, spot: StoredSpot): void {
    this.#spots.set(number, { ...spot });
  }

  sessionOf(sessionId: string): StoredAnsweringSession | undefined {
    const session = this.#sessions.get(sessionId);
    return session === undefined ? undefined : { ...session };
  }

  spotOf(number: string): StoredSpot | undefined {
    const spot = this.#spots.get(number);
    return spot === undefined ? undefined : { ...spot };
  }

  answer({ sessionId, driverId, spotNumber }: SpotAnswer): Promise<ParkedAnswer> {
    this.answeredNumbers.push(spotNumber);
    const session = this.#sessions.get(sessionId);
    if (session?.driverId !== driverId) {
      return Promise.resolve({ outcome: 'not-found' });
    }
    return Promise.resolve(this.isLotBusy ? { outcome: 'lot-busy' } : this.#answerOwn(session, spotNumber));
  }

  #answerOwn(session: StoredAnsweringSession, spotNumber: string): ParkedAnswer {
    const decision = decideSessionAnswer(session.state);
    if (decision === 'already') {
      return { outcome: 'already', spot: labelOf(session.confirmedSpotNumber ?? '') };
    }
    if (decision !== 'take-spot') {
      return { outcome: decision };
    }
    return this.#placeCar(session, spotNumber);
  }

  #placeCar(session: StoredAnsweringSession, typedNumber: string): ParkedAnswer {
    const spotNumber = this.#paintedNumberOf(typedNumber);
    const spot = spotNumber === undefined ? undefined : this.#spots.get(spotNumber);
    if (spotNumber === undefined || spot === undefined) {
      return { outcome: 'unknown-spot' };
    }
    const placement = placementOf({ sessionState: session.state, assignedSpotId: session.assignedSpotNumber, spotId: spotNumber, spotState: spot.state });
    if (placement.outcome === 'refused') {
      return { outcome: placement.refusal };
    }
    this.writes += 1;
    if (placement.occupiesAnswered) {
      Object.assign(spot, { state: 'OCCUPIED', needsCheck: false });
    }
    if (placement.flagsAssigned) {
      this.#flagToCheck(session.assignedSpotNumber);
    }
    Object.assign(session, { state: 'PARKED_CONFIRMED', confirmedSpotNumber: spotNumber, answeredAt: new Date() });
    return { outcome: 'confirmed', spot: labelOf(spotNumber) };
  }

  // Like the SQL guard: only an occupied presumed spot can be flagged, anything else is a broken invariant.
  #flagToCheck(spotNumber: string): void {
    const spot = this.#spots.get(spotNumber);
    if (spot?.state !== 'OCCUPIED') {
      throw new Error(`Assigned spot ${spotNumber} of a session leaving it was not occupied.`);
    }
    Object.assign(spot, { state: 'OCCUPIED_UNKNOWN', needsCheck: true });
  }

  // Exact match first, then the same number without case, spaces or dashes, like the repository.
  #paintedNumberOf(typedNumber: string): string | undefined {
    return paintedNumberNamed([...this.#spots.keys()], typedNumber);
  }
}

function labelOf(number: string): AssignedSpot {
  return { number, levelCode: 'P1', aisleCode: number.slice(0, 1) };
}
