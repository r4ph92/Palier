import type { PresenceCheck, PresenceRefusal, StaleSessionListRead, StaleSessionReviewRepository } from '../../domain/dashboard/StaleSessionReviewRepository.ts';
import type { Database, Transaction } from './database.ts';
import { writeInOwnedLot } from './ownedLotWrite.ts';
import { appendSessionEvent, type SessionEventWrite } from './sessionEventStatements.ts';
import { staleSessionListOf, type StaleSessionRow } from './staleSessionReviewRows.ts';
import { confirmPresenceStatement, lockSessionToConfirmStatement, readStaleSessionsStatement } from './staleSessionReviewStatements.ts';
import { requireUpdatedRow } from './requireUpdatedRow.ts';

interface SessionToConfirmRow extends Record<string, unknown> {
  readonly flagged: boolean;
}

export class PostgresStaleSessionReviewRepository implements StaleSessionReviewRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listStaleSessions(operatorId: string, lotId: string): Promise<StaleSessionListRead | null> {
    return staleSessionListOf(await this.#database.execute<StaleSessionRow>(readStaleSessionsStatement(operatorId, lotId)));
  }

  confirmPresence(operatorId: string, check: PresenceCheck): Promise<'CONFIRMED' | PresenceRefusal> {
    return writeInOwnedLot(this.#database, { operatorId, lotId: check.lotId }, (tx) => confirmFlaggedSession(tx, check));
  }
}

async function confirmFlaggedSession(tx: Transaction, check: PresenceCheck): Promise<'CONFIRMED' | PresenceRefusal> {
  const [session] = await tx.execute<SessionToConfirmRow>(lockSessionToConfirmStatement(check));
  if (session === undefined) {
    return 'SESSION_NOT_FOUND';
  }
  if (session.flagged) {
    requireUpdatedRow(await tx.execute(confirmPresenceStatement(check)), `Session ${check.sessionId} could not be confirmed under its lock.`);
    await appendSessionEvent(tx, presenceEventOf(check));
  }
  return 'CONFIRMED';
}

// Dated by the presence column the update just wrote, with an empty payload: who checked is on the session, not in the log.
function presenceEventOf({ sessionId, lotId }: PresenceCheck): SessionEventWrite {
  return { sessionId, lotId, occurredAt: 'presence_confirmed_at', event: { kind: 'PRESENCE_CONFIRMED', payload: {} } };
}
