import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import {
  classifyRefusedSignal,
  type ParkedPresumption,
  type ParkedPresumptionRepository,
  type SessionAfterRefusal,
  type WalkingSignal,
  wrongAisleOf,
} from '../../domain/parkingSessions/ParkedPresumption.ts';
import type { Database } from './database.ts';
import { isLotBusy, orLotBusy } from './lockParkingLot.ts';
import { presumeOnFoot } from './onFootPresumption.ts';
import { askWhereParked, readWalkFacts, type WrongAisleWalk } from './wrongAisleWalk.ts';

interface SessionAfterRefusalRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly parked_at: Date | string | null;
}

const MAX_WALK_ATTEMPTS = 2;

// The walk in the spot's aisle writes no spot and takes no lot lock: the loop confirmation already made the spot OCCUPIED (decision 019);
// its events go in the same statement (decision 037). A walk in another aisle flags that spot under the lot lock and asks the driver
// where they parked (decision 020).
export class PostgresParkedPresumptionRepository implements ParkedPresumptionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async presume(signal: WalkingSignal): Promise<ParkedPresumption> {
    if (signal.detectedAisleMinor === null) {
      return this.#recordedOrRefused(signal, await presumeOnFoot(this.#database, { signal, assignedSpotId: null, assignedAisleSeen: null }));
    }
    for (let attempt = 0; attempt < MAX_WALK_ATTEMPTS; attempt += 1) {
      const walk = await this.#walkOnFacts(signal);
      if (walk !== null) {
        return walk;
      }
    }
    return classifyRefusedSignal(await this.#readSessionAfterRefusal(signal));
  }

  // Null when the write found the confirmed entry changed since its facts were read, a spot-taken report in between: the caller reads them again.
  // A presumed session is tried once in the spot's aisle, for a late walk replacing a timeout (#147); one it cannot replace is read back, a correction may have won the race.
  // Another aisle asks nothing once the session is presumed.
  async #walkOnFacts(signal: WalkingSignal): Promise<ParkedPresumption | null> {
    const facts = await readWalkFacts(this.#database, signal);
    if (facts === null || (facts.state !== 'ENTRY_CONFIRMED' && facts.state !== 'PARKED_PRESUMED')) {
      return classifyRefusedSignal(facts);
    }
    const wrongAisle = wrongAisleOf(facts);
    if (wrongAisle !== null) {
      return facts.state === 'ENTRY_CONFIRMED' ? this.#askWhereParked({ signal, facts, wrongAisle }) : classifyRefusedSignal(facts);
    }
    const parkedAt = await presumeOnFoot(this.#database, { signal, assignedSpotId: facts.assignedSpotId, assignedAisleSeen: facts.detectedAisle });
    if (parkedAt !== null) {
      return { outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt };
    }
    return facts.state === 'ENTRY_CONFIRMED' ? null : classifyRefusedSignal(await this.#readSessionAfterRefusal(signal));
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

  async #readSessionAfterRefusal({ sessionId, driverId }: WalkingSignal): Promise<SessionAfterRefusal | null> {
    const [row] = await this.#database.execute<SessionAfterRefusalRow>(sql`
      select state, parked_at from parking_session where id = ${sessionId} and user_id = ${driverId}`);
    if (row === undefined) {
      return null;
    }
    return { state: row.state, parkedAt: row.parked_at === null ? null : new Date(row.parked_at) };
  }
}
