import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import {
  classifyRefusedSignal,
  wrongAisleOf,
  type ParkedPresumption,
  type ParkedPresumptionRepository,
  type SessionAfterRefusal,
  type WalkingSignal,
} from '../../domain/parkingSessions/ParkedPresumption.ts';
import type { Database } from './database.ts';
import { isLockTimeout } from './lockTimeout.ts';
import { askWhereParked, readWalkFacts, type WalkFacts } from './wrongAisleWalk.ts';

interface ParkedAtRow extends Record<string, unknown> {
  readonly parked_at: Date | string;
}

interface SessionAfterRefusalRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly parked_at: Date | string | null;
}

// The walk in the spot's aisle writes no spot and takes no lot lock: the loop confirmation already made the spot OCCUPIED (decision 019).
// A walk in another aisle flags that spot under the lot lock and asks the driver where they parked (decision 020).
export class PostgresParkedPresumptionRepository implements ParkedPresumptionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async presume(signal: WalkingSignal): Promise<ParkedPresumption> {
    if (signal.detectedAisleMinor === null) {
      return this.#presumeAssignedSpot(signal);
    }
    const facts = await readWalkFacts(this.#database, signal);
    if (facts?.state !== 'ENTRY_CONFIRMED') {
      return classifyRefusedSignal(facts);
    }
    const aisleId = wrongAisleOf(facts);
    return aisleId === null ? this.#presumeAssignedSpot(signal) : this.#askWhereParked(signal, facts, aisleId);
  }

  async #presumeAssignedSpot(signal: WalkingSignal): Promise<ParkedPresumption> {
    const parkedAt = await this.#presumeConfirmedEntry(signal);
    if (parkedAt !== null) {
      return { outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt };
    }
    return classifyRefusedSignal(await this.#readSessionAfterRefusal(signal));
  }

  async #askWhereParked(signal: WalkingSignal, { lotId }: WalkFacts, aisleId: string): Promise<ParkedPresumption> {
    try {
      const parkedAt = await askWhereParked(this.#database, { signal, lotId, aisleId });
      if (parkedAt !== null) {
        return { outcome: 'recorded', state: 'PARKED_UNCONFIRMED', parkedAt };
      }
      return classifyRefusedSignal(await this.#readSessionAfterRefusal(signal));
    } catch (error) {
      if (isLockTimeout(error)) {
        return { outcome: 'lot-busy' };
      }
      throw error;
    }
  }

  // The device clock is trusted only up to the database clock, and never before the loop confirmation, whose gate clock may run ahead.
  async #presumeConfirmedEntry({ sessionId, driverId, detectedAt }: WalkingSignal): Promise<Date | null> {
    const [row] = await this.#database.execute<ParkedAtRow>(sql`
      update parking_session
      set state = 'PARKED_PRESUMED', parked_at = greatest(least(${detectedAt.toISOString()}::timestamptz, now()), entry_confirmed_at)
      where id = ${sessionId} and user_id = ${driverId} and state = 'ENTRY_CONFIRMED'
      returning parked_at`);
    return row === undefined ? null : new Date(row.parked_at);
  }

  async #readSessionAfterRefusal({ sessionId, driverId }: WalkingSignal): Promise<SessionAfterRefusal | null> {
    const [row] = await this.#database.execute<SessionAfterRefusalRow>(sql`
      select state, parked_at from parking_session where id = ${sessionId} and user_id = ${driverId}`);
    if (row === undefined) {
      return null;
    }
    return { state: row.state, parkedAt: row.parked_at === null ? null : new Date(row.parked_at) };
  }
}
