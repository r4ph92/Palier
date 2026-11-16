import type { SessionDetailRead, SessionListRead, SessionPage, SessionTimelineRepository } from '../../domain/dashboard/SessionTimelineRepository.ts';
import type { Database } from './database.ts';
import { sessionRecordOf, storedEventOf, type SessionEventRow, type SessionRow } from './sessionTimelineRows.ts';
import { listSessionsStatement, readOwnedLotNameStatement, readSessionEventsStatement, readSessionStatement } from './sessionTimelineStatements.ts';

interface LotNameRow extends Record<string, unknown> {
  readonly lot_name: string;
}

export class PostgresSessionTimelineRepository implements SessionTimelineRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listSessions(operatorId: string, lotId: string, page: SessionPage): Promise<SessionListRead | null> {
    const lotName = await this.#ownedLotName(operatorId, lotId);
    if (lotName === null) {
      return null;
    }
    const rows = await this.#database.execute<SessionRow>(listSessionsStatement(operatorId, lotId, page));
    return { lotName, sessions: rows.map(sessionRecordOf) };
  }

  async readSession(operatorId: string, lotId: string, sessionId: string): Promise<SessionDetailRead | null> {
    const lotName = await this.#ownedLotName(operatorId, lotId);
    if (lotName === null) {
      return null;
    }
    const [row] = await this.#database.execute<SessionRow>(readSessionStatement(operatorId, lotId, sessionId));
    if (row === undefined) {
      return { lotName, session: null };
    }
    const events = await this.#database.execute<SessionEventRow>(readSessionEventsStatement(operatorId, lotId, sessionId));
    return { lotName, session: { ...sessionRecordOf(row), events: events.map(storedEventOf) } };
  }

  async #ownedLotName(operatorId: string, lotId: string): Promise<string | null> {
    const [row] = await this.#database.execute<LotNameRow>(readOwnedLotNameStatement(operatorId, lotId));
    return row?.lot_name ?? null;
  }
}
