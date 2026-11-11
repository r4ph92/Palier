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
import { clampedParkedAt } from './clampedParkedAt.ts';
import type { Database } from './database.ts';
import { isLotBusy, orLotBusy } from './lockParkingLot.ts';
import { askWhereParked, readWalkFacts, type WrongAisleWalk } from './wrongAisleWalk.ts';

interface ParkedAtRow extends Record<string, unknown> {
  readonly parked_at: Date | string;
}

interface SessionAfterRefusalRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly parked_at: Date | string | null;
}

const MAX_WALK_ATTEMPTS = 2;

// The walk in the spot's aisle writes no spot and takes no lot lock: the loop confirmation already made the spot OCCUPIED (decision 019).
// A walk in another aisle flags that spot under the lot lock and asks the driver where they parked (decision 020).
export class PostgresParkedPresumptionRepository implements ParkedPresumptionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async presume(signal: WalkingSignal): Promise<ParkedPresumption> {
    if (signal.detectedAisleMinor === null) {
      return this.#recordedOrRefused(signal, await this.#presumeConfirmedEntry(signal, null));
    }
    for (let attempt = 0; attempt < MAX_WALK_ATTEMPTS; attempt += 1) {
      const walk = await this.#walkOnFacts(signal);
      if (walk !== null) {
        return walk;
      }
    }
    return classifyRefusedSignal(await this.#readSessionAfterRefusal(signal));
  }

  // Null when the write found the session changed since its facts were read, a spot-taken report in between: the caller reads them again.
  async #walkOnFacts(signal: WalkingSignal): Promise<ParkedPresumption | null> {
    const facts = await readWalkFacts(this.#database, signal);
    if (facts?.state !== 'ENTRY_CONFIRMED') {
      return classifyRefusedSignal(facts);
    }
    const aisleId = wrongAisleOf(facts);
    if (aisleId !== null) {
      return this.#askWhereParked({ signal, facts, aisleId });
    }
    const parkedAt = await this.#presumeConfirmedEntry(signal, facts.assignedSpotId);
    return parkedAt === null ? null : { outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt };
  }

  async #recordedOrRefused(signal: WalkingSignal, parkedAt: Date | null): Promise<ParkedPresumption> {
    if (parkedAt !== null) {
      return { outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt };
    }
    return classifyRefusedSignal(await this.#readSessionAfterRefusal(signal));
  }

  async #askWhereParked(walk: WrongAisleWalk): Promise<ParkedPresumption | null> {
    const parkedAt = await orLotBusy(askWhereParked(this.#database, walk));
    if (isLotBusy(parkedAt)) {
      return parkedAt;
    }
    return parkedAt === null ? null : { outcome: 'recorded', state: 'PARKED_UNCONFIRMED', parkedAt };
  }

  // assignedSpotId: the spot the walk's facts were read with, when they were; the update then waits for that spot only.
  async #presumeConfirmedEntry({ sessionId, driverId, detectedAt }: WalkingSignal, assignedSpotId: string | null): Promise<Date | null> {
    const sameSpot = assignedSpotId === null ? sql.empty() : sql` and assigned_spot_id = ${assignedSpotId}`;
    const [row] = await this.#database.execute<ParkedAtRow>(sql`
      update parking_session
      set state = 'PARKED_PRESUMED', presumed_by = 'WALK', parked_at = ${clampedParkedAt(detectedAt)}
      where id = ${sessionId} and user_id = ${driverId} and state = 'ENTRY_CONFIRMED'${sameSpot}
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
