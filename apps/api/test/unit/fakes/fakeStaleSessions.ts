import type { EntrySessionState } from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import type { StaleCheck, StaleSessionRepository } from '../../../src/domain/parkingSessions/flagStaleSessions.ts';
import { isStale, type SessionProofs } from '../../../src/domain/parkingSessions/sessionProofs.ts';

export interface FakeStaleSession extends SessionProofs {
  readonly state: EntrySessionState;
  staleFlaggedAt: Date | null;
}

// Applies the same cut as the SQL: active, not flagged yet, last proof at or before the cutoff; the statements themselves are proven on scripted SQL.
export class FakeStaleSessionRepository implements StaleSessionRepository {
  readonly sessions: FakeStaleSession[] = [];
  readonly checks: ({ readonly lotId: string } & StaleCheck)[] = [];

  findLotsWithStaleSessions(cutoff: Date): Promise<string[]> {
    return Promise.resolve(this.sessions.some((session) => isDue(session, cutoff)) ? ['lot-demo'] : []);
  }

  flagLotStaleSessions(lotId: string, check: StaleCheck): Promise<number> {
    this.checks.push({ lotId, ...check });
    const due = this.sessions.filter((session) => isDue(session, check.cutoff));
    for (const session of due) {
      session.staleFlaggedAt = check.now;
    }
    return Promise.resolve(due.length);
  }

  confirmPresence(session: FakeStaleSession, at: Date): void {
    Object.assign(session, { presenceConfirmedAt: at, staleFlaggedAt: null });
  }
}

const ACTIVE_STATES: readonly EntrySessionState[] = ACTIVE_ENTRY_SESSION_STATES;

function isDue(session: FakeStaleSession, cutoff: Date): boolean {
  return ACTIVE_STATES.includes(session.state) && session.staleFlaggedAt === null && isStale(session, cutoff);
}
