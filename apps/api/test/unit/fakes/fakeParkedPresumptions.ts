import type { EntrySessionState } from '@palier/shared-types';
import {
  presumptionOfUnchanged,
  type ParkedPresumption,
  type ParkedPresumptionRepository,
  type WalkingSignal,
} from '../../../src/domain/parkingSessions/ParkedPresumption.ts';

export interface StoredWalkingSession {
  readonly driverId: string;
  state: EntrySessionState;
  entryConfirmedAt: Date | null;
  parkedAt: Date | null;
}

// Mirrors the guarded UPDATE of PostgresParkedPresumptionRepository; its SQL is checked on the lane database (docs/decisions/002).
export class FakeParkedPresumptions implements ParkedPresumptionRepository {
  writes = 0;
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

  presume({ sessionId, driverId, detectedAt }: WalkingSignal): Promise<ParkedPresumption> {
    const session = this.#sessions.get(sessionId);
    const owned = session?.driverId === driverId ? session : null;
    if (owned?.state !== 'ENTRY_CONFIRMED') {
      return Promise.resolve(presumptionOfUnchanged(owned));
    }
    this.writes += 1;
    owned.state = 'PARKED_PRESUMED';
    owned.parkedAt = this.#clamped(detectedAt, owned.entryConfirmedAt);
    return Promise.resolve({ outcome: 'presumed', parkedAt: owned.parkedAt });
  }

  #clamped(detectedAt: Date, entryConfirmedAt: Date | null): Date {
    const notBeforeConfirmation = entryConfirmedAt !== null && detectedAt < entryConfirmedAt ? entryConfirmedAt : detectedAt;
    const now = this.#now();
    return notBeforeConfirmation > now ? now : notBeforeConfirmation;
  }
}
