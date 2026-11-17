import type { StaleCheck, StaleSessionRepository } from '../../domain/parkingSessions/flagStaleSessions.ts';
import type { Database } from './database.ts';
import { inLotLock, orLotBusyError } from './lockParkingLot.ts';
import { findLotsWithStaleSessions, flagStaleSessionsOfLot } from './staleSessionStatements.ts';

export class PostgresStaleSessionRepository implements StaleSessionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  findLotsWithStaleSessions(cutoff: Date): Promise<string[]> {
    return findLotsWithStaleSessions(this.#database, cutoff);
  }

  // The guards in the UPDATE decide any race; the lot lock only keeps the lot-then-session order of the locking writers.
  flagLotStaleSessions(lotId: string, check: StaleCheck): Promise<number> {
    return orLotBusyError(lotId, inLotLock(this.#database, lotId, (tx) => flagStaleSessionsOfLot(tx, lotId, check)));
  }
}
