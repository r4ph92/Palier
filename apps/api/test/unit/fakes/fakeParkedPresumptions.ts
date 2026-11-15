import type { EntrySessionState } from '@palier/shared-types';
import {
  classifyRefusedSignal,
  wrongAisleOf,
  type ParkedPresumption,
  type ParkedPresumptionRepository,
  type WalkingSignal,
} from '../../../src/domain/parkingSessions/ParkedPresumption.ts';

export interface StoredWalkingSession {
  readonly driverId: string;
  state: EntrySessionState;
  entryConfirmedAt: Date | null;
  parkedAt: Date | null;
  // The minor of the assigned spot's aisle, aisle A of Parking Démo unless a test says otherwise.
  readonly assignedAisleMinor?: number;
  parkedAisleMinor?: number | null;
  isAssignedSpotFlagged?: boolean;
}

// Parking Démo's drivable aisles: A (minor 1) and B (minor 2).
const LOT_AISLE_MINORS: ReadonlySet<number> = new Set([1, 2]);
const AISLE_A_MINOR = 1;

// Mirrors PostgresParkedPresumptionRepository; its SQL is checked on the lane database (docs/decisions/002).
export class FakeParkedPresumptions implements ParkedPresumptionRepository {
  writes = 0;
  isLotBusy = false;
  readonly #sessions = new Map<string, StoredWalkingSession>();
  readonly #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  add(sessionId: string, session: StoredWalkingSession): void {
    this.#sessions.set(sessionId, { ...session });
  }

  sessionOf(sessionId: string): StoredWalkingSession | undefined {
    const session = this.#sessions.get(sessionId);
    return session === undefined ? undefined : { ...session };
  }

  presume({ sessionId, driverId, detectedAt, detectedAisleMinor }: WalkingSignal): Promise<ParkedPresumption> {
    const session = this.#sessions.get(sessionId);
    const owned = session?.driverId === driverId ? session : null;
    if (owned?.state !== 'ENTRY_CONFIRMED') {
      return Promise.resolve(classifyRefusedSignal(owned));
    }
    const wrongAisleMinor = wrongAisleMinorOf(owned, detectedAisleMinor);
    if (wrongAisleMinor !== null && this.isLotBusy) {
      return Promise.resolve({ outcome: 'lot-busy' });
    }
    this.writes += 1;
    owned.parkedAt = this.#clamped(detectedAt, owned.entryConfirmedAt);
    owned.state = wrongAisleMinor === null ? 'PARKED_PRESUMED' : 'PARKED_UNCONFIRMED';
    owned.parkedAisleMinor = wrongAisleMinor;
    owned.isAssignedSpotFlagged = wrongAisleMinor !== null;
    return Promise.resolve({ outcome: 'recorded', state: owned.state, parkedAt: owned.parkedAt });
  }

  #clamped(detectedAt: Date, entryConfirmedAt: Date | null): Date {
    const now = this.#now();
    const notAfterNow = detectedAt > now ? now : detectedAt;
    return entryConfirmedAt !== null && notAfterNow < entryConfirmedAt ? entryConfirmedAt : notAfterNow;
  }
}

// The fake's aisles are known by their minor, so the minor stands for the aisle id the real rule compares.
function wrongAisleMinorOf(session: StoredWalkingSession, detectedAisleMinor: number | null): number | null {
  const isKnownAisle = detectedAisleMinor !== null && LOT_AISLE_MINORS.has(detectedAisleMinor);
  const assignedAisleId = String(session.assignedAisleMinor ?? AISLE_A_MINOR);
  const detectedAisle = isKnownAisle ? { id: String(detectedAisleMinor), code: String(detectedAisleMinor), beaconMinor: detectedAisleMinor } : null;
  return wrongAisleOf({ assignedAisleId, detectedAisle })?.beaconMinor ?? null;
}
