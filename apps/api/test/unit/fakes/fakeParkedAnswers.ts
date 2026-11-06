import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import {
  decideSessionAnswer,
  decideSpotAnswer,
  type ParkedAnswer,
  type ParkedAnswerRepository,
  type SpotAnswer,
} from '../../../src/domain/parkingSessions/ParkedAnswer.ts';
import type { SpotState } from '../../../src/domain/spots/spotStates.ts';

export interface StoredAnsweringSession {
  readonly driverId: string;
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

  #placeCar(session: StoredAnsweringSession, spotNumber: string): ParkedAnswer {
    const spot = this.#spots.get(spotNumber);
    if (spot === undefined) {
      return { outcome: 'unknown-spot' };
    }
    const decision = decideSpotAnswer(spot.state);
    if (decision !== 'occupy') {
      return { outcome: decision };
    }
    this.writes += 1;
    Object.assign(spot, { state: 'OCCUPIED', needsCheck: false });
    Object.assign(session, { state: 'PARKED_CONFIRMED', confirmedSpotNumber: spotNumber, answeredAt: new Date() });
    return { outcome: 'confirmed', spot: labelOf(spotNumber) };
  }
}

function labelOf(number: string): AssignedSpot {
  return { number, levelCode: 'P1', aisleCode: number.slice(0, 1) };
}
