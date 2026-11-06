import type { EntrySessionState } from '@palier/shared-types';
import { chooseReplacementSpot } from '../../../src/domain/allocation/chooseReplacementSpot.ts';
import type { FreeSpot } from '../../../src/domain/allocation/chooseSpot.ts';
import { reportPlanOf, type SpotTakenOutcome, type SpotTakenReport, type SpotTakenReportRepository } from '../../../src/domain/parkingSessions/SpotTakenReport.ts';
import type { SpotState } from '../../../src/domain/spots/spotStates.ts';
import { standardNeeds } from '../fakeVehicleRepository.ts';

export interface StoredReportingSession {
  readonly driverId: string;
  state: EntrySessionState;
  assignedSpotNumber: string;
  parkedAisleCode: string | null;
  readonly reportedSpotNumbers: string[];
}

export interface StoredReportSpot {
  state: SpotState;
  needsCheck: boolean;
  readonly isEv?: boolean;
}

// Parking Démo, level P1, as the seed builds it: A-1 to A-5 in aisle A, B-1 to B-5 in aisle B, each nearer the exit by its index.
function parkingDemoSpots(): Map<string, StoredReportSpot> {
  const numbers = ['A', 'B'].flatMap((aisle) => [1, 2, 3, 4, 5].map((index) => `${aisle}-${String(index)}`));
  return new Map(numbers.map((number) => [number, { state: 'AVAILABLE', needsCheck: false }]));
}

// Mirrors PostgresSpotTakenReportRepository over one lot with standard needs; its SQL is checked by ScriptedSql and on the lane database.
export class FakeSpotTakenReports implements SpotTakenReportRepository {
  writes = 0;
  isLotBusy = false;
  readonly #sessions = new Map<string, StoredReportingSession>();
  readonly #spots = parkingDemoSpots();

  add(sessionId: string, session: Omit<StoredReportingSession, 'reportedSpotNumbers'>): void {
    this.#sessions.set(sessionId, { ...session, reportedSpotNumbers: [] });
  }

  setSpot(number: string, spot: StoredReportSpot): void {
    this.#spots.set(number, { ...spot });
  }

  sessionOf(sessionId: string): StoredReportingSession | undefined {
    const session = this.#sessions.get(sessionId);
    return session === undefined ? undefined : { ...session, reportedSpotNumbers: [...session.reportedSpotNumbers] };
  }

  spotOf(number: string): StoredReportSpot | undefined {
    const spot = this.#spots.get(number);
    return spot === undefined ? undefined : { ...spot };
  }

  report({ sessionId, driverId, spotNumber }: SpotTakenReport): Promise<SpotTakenOutcome> {
    const session = this.#sessions.get(sessionId);
    if (session?.driverId !== driverId) {
      return Promise.resolve({ outcome: 'not-found' });
    }
    return Promise.resolve(this.isLotBusy ? { outcome: 'lot-busy' } : this.#reportOwn(session, spotNumber));
  }

  #reportOwn(session: StoredReportingSession, reportedNumber: string): SpotTakenOutcome {
    const assigned = this.#existingSpot(session.assignedSpotNumber);
    const plan = reportPlanOf({ sessionState: session.state, assignedSpot: { number: session.assignedSpotNumber, state: assigned.state }, reportedNumber });
    if (plan.outcome === 'refused') {
      return { outcome: plan.refusal };
    }
    this.writes += 1;
    if (plan.flagsReported) {
      Object.assign(assigned, { state: 'OCCUPIED_UNKNOWN', needsCheck: true });
    }
    session.reportedSpotNumbers.push(session.assignedSpotNumber);
    return this.#moveDriver(session);
  }

  #moveDriver(session: StoredReportingSession): SpotTakenOutcome {
    const aisleCode = aisleOf(session.assignedSpotNumber);
    const chosen = chooseReplacementSpot(standardNeeds, this.#freeSpots(), aisleCode);
    if (chosen === null) {
      Object.assign(session, { state: 'PARKED_UNCONFIRMED', parkedAisleCode: aisleCode });
      return { outcome: 'none-free' };
    }
    Object.assign(this.#existingSpot(chosen.number), { state: 'OCCUPIED' });
    session.assignedSpotNumber = chosen.number;
    return { outcome: 'reassigned', spot: { number: chosen.number, levelCode: 'P1', aisleCode: chosen.aisleCode } };
  }

  #freeSpots(): FreeSpot[] {
    return [...this.#spots.entries()]
      .filter(([, spot]) => spot.state === 'AVAILABLE')
      .map(([number, spot]) => freeSpotOf(number, spot));
  }

  #existingSpot(number: string): StoredReportSpot {
    const spot = this.#spots.get(number);
    if (spot === undefined) {
      throw new Error(`Parking Démo has no spot ${number}.`);
    }
    return spot;
  }
}

function aisleOf(number: string): string {
  return number.slice(0, 1);
}

// The aisle code stands for the aisle id here: one level, aisles named once.
function freeSpotOf(number: string, spot: StoredReportSpot): FreeSpot {
  const aisleCode = aisleOf(number);
  const distanceToExit = Number(number.slice(2)) * 5;
  return { id: number, number, levelOrder: 1, aisleId: aisleCode, aisleCode, distanceToExit, needsCheck: spot.needsCheck, isEv: spot.isEv ?? false, isAccessible: false, isOversize: false };
}
