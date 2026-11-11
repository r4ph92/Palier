import type { SilenceCheck, SilentPresumptions, SilentSessionRepository } from '../../domain/parkingSessions/presumeSilentSessions.ts';
import type { Database } from './database.ts';
import { inLotLock } from './lockParkingLot.ts';
import { findLotsWithSilentSessions, presumeSilentConfirmedEntries, presumeUnansweredQuestions } from './silentSessionStatements.ts';

export class PostgresSilentSessionRepository implements SilentSessionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  findLotsWithSilentSessions(cutoff: Date): Promise<string[]> {
    return findLotsWithSilentSessions(this.#database, cutoff);
  }

  // The state guard in each UPDATE decides any race; the lot lock only keeps the lot-then-session order of the locking writers.
  presumeLotSilentSessions(lotId: string, silence: SilenceCheck): Promise<SilentPresumptions> {
    return inLotLock(this.#database, lotId, async (tx) => ({
      confirmedEntries: await presumeSilentConfirmedEntries(tx, lotId, silence),
      unansweredQuestions: await presumeUnansweredQuestions(tx, lotId, silence),
    }));
  }
}
