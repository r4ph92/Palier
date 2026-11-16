import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import type { SessionDetailRead, SessionListRead, SessionPage, SessionRecord, SessionTimelineRepository, StoredSessionEvent } from '../../../src/domain/dashboard/SessionTimelineRepository.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';

export interface FakeStoredSession extends SessionRecord {
  readonly lotId: string;
  readonly events: StoredSessionEvent[];
}

// Keeps the rules the SQL keeps: the operator's lot only, newest entry first by (entry, id), open means an active state, the cursor is looked up in the lot.
export class FakeSessionTimelineRepository implements SessionTimelineRepository {
  readonly sessions: FakeStoredSession[] = [];
  readonly #lots: FakeLotStore;

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  listSessions(operatorId: string, lotId: string, page: SessionPage): Promise<SessionListRead | null> {
    const lotName = this.#lotNameOf(operatorId, lotId);
    if (lotName === null) {
      return Promise.resolve(null);
    }
    const newestFirst = this.#sessionsOf(lotId).filter((session) => isWanted(session, page.status)).sort(newestFirstOrder);
    const sessions = page.before === null ? newestFirst : this.#after(newestFirst, lotId, page.before);
    return Promise.resolve({ lotName, sessions: sessions.slice(0, page.limit) });
  }

  readSession(operatorId: string, lotId: string, sessionId: string): Promise<SessionDetailRead | null> {
    const lotName = this.#lotNameOf(operatorId, lotId);
    if (lotName === null) {
      return Promise.resolve(null);
    }
    const session = this.#sessionsOf(lotId).find(({ id }) => id === sessionId);
    return Promise.resolve({ lotName, session: session ?? null });
  }

  #lotNameOf(operatorId: string, lotId: string): string | null {
    return this.#lots.owned[this.#lots.indexOf(operatorId, lotId)]?.name ?? null;
  }

  #sessionsOf(lotId: string): FakeStoredSession[] {
    return this.sessions.filter((session) => session.lotId === lotId);
  }

  #after(newestFirst: FakeStoredSession[], lotId: string, before: string): FakeStoredSession[] {
    const last = this.#sessionsOf(lotId).find(({ id }) => id === before);
    return last === undefined ? [] : newestFirst.filter((session) => newestFirstOrder(last, session) < 0);
  }
}

function isWanted(session: SessionRecord, status: SessionPage['status']): boolean {
  return status === 'ALL' || (ACTIVE_ENTRY_SESSION_STATES as readonly string[]).includes(session.state);
}

function newestFirstOrder(left: SessionRecord, right: SessionRecord): number {
  return right.enteredAt.getTime() - left.enteredAt.getTime() || right.id.localeCompare(left.id);
}
