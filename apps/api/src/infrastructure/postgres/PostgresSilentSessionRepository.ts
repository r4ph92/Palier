import type { SilenceCheck, SilentPresumptions, SilentSessionRepository } from '../../domain/parkingSessions/presumeSilentSessions.ts';
import type { Database } from './database.ts';
import { LOT_LOCK_TRANSACTION, lockParkingLot } from './lockParkingLot.ts';
import { LIMIT_LOCK_WAIT } from './lockTimeout.ts';
import { findLotsWithSilentSessions, presumeSilentConfirmedEntries, presumeUnansweredQuestions } from './silentSessionStatements.ts';

export class PostgresSilentSessionRepository implements SilentSessionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  findLotsWithSilentSessions(cutoff: Date): Promise<string[]> {
    return findLotsWithSilentSessions(this.#database, cutoff);
  }

  // Under the lot lock like every other writer of a session's state; each UPDATE re-checks the state, so a walk or an answer that won the race stands.
  presumeLotSilentSessions(lotId: string, silence: SilenceCheck): Promise<SilentPresumptions> {
    return this.#database.transaction(async (tx) => {
      await tx.execute(LIMIT_LOCK_WAIT);
      await lockParkingLot(tx, lotId);
      return {
        confirmedEntries: await presumeSilentConfirmedEntries(tx, lotId, silence),
        unansweredQuestions: await presumeUnansweredQuestions(tx, lotId, silence),
      };
    }, LOT_LOCK_TRANSACTION);
  }
}
