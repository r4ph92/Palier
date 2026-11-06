import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import {
  classifyRefusedSignal,
  type ParkedPresumption,
  type ParkedPresumptionRepository,
  type SessionAfterRefusal,
  type WalkingSignal,
} from '../../domain/parkingSessions/ParkedPresumption.ts';
import type { Database } from './database.ts';

interface ParkedAtRow extends Record<string, unknown> {
  readonly parked_at: Date | string;
}

interface SessionAfterRefusalRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly parked_at: Date | string | null;
}

// No spot write and no lot lock: the loop confirmation already made the spot OCCUPIED, and nothing is allocated (decision 019).
export class PostgresParkedPresumptionRepository implements ParkedPresumptionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async presume(signal: WalkingSignal): Promise<ParkedPresumption> {
    const parkedAt = await this.#presumeConfirmedEntry(signal);
    if (parkedAt !== null) {
      return { outcome: 'presumed', parkedAt };
    }
    return classifyRefusedSignal(await this.#readSessionAfterRefusal(signal));
  }

  // The device clock is trusted only between the loop confirmation and the database clock.
  async #presumeConfirmedEntry({ sessionId, driverId, detectedAt }: WalkingSignal): Promise<Date | null> {
    const [row] = await this.#database.execute<ParkedAtRow>(sql`
      update parking_session
      set state = 'PARKED_PRESUMED', parked_at = least(greatest(${detectedAt.toISOString()}::timestamptz, entry_confirmed_at), now())
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
