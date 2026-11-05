import type { EntrySessionState } from '@palier/shared-types';
import type { JobLog } from '../../../src/domain/JobLog.ts';
import type { ExpiredEntry, PendingRelease, UnconfirmedEntryRepository } from '../../../src/domain/entries/UnconfirmedEntryRepository.ts';
import type { OpeningWindow } from '../../../src/domain/gates/OpeningWindow.ts';

export interface FakeEntrySession {
  readonly sessionId: string;
  readonly spot: string;
  readonly paymentIntentId: string | null;
  // How long ago the barrier opened, by the database clock.
  readonly openedMillisecondsAgo: number;
  state: EntrySessionState;
  holdReleasePending: boolean;
  releaseAttempts: number;
}

const LOT_ID = '00000000-0000-4000-8000-000000000201';

// Mirrors PostgresUnconfirmedEntryRepository: a strict window edge, a CREATED guard and the least recently attempted holds first.
export class FakeUnconfirmedEntryRepository implements UnconfirmedEntryRepository {
  readonly sessions: FakeEntrySession[] = [];
  readonly freedSpots: string[] = [];
  readonly failingCancels = new Set<string>();
  // Runs just before a cancellation, as a loop closure queued on the lot would.
  beforeCancel: (sessionId: string) => void = () => undefined;
  #attemptSequence = 0;
  readonly #lastAttempt = new Map<string, number>();

  add(sessionId: string, openedMillisecondsAgo: number, paymentIntentId: string | null = `pi_${sessionId}`): FakeEntrySession {
    const session = { sessionId, spot: `A-${this.sessions.length + 1}`, paymentIntentId, openedMillisecondsAgo, state: 'CREATED' as const, holdReleasePending: false, releaseAttempts: 0 };
    this.sessions.push(session);
    return session;
  }

  session(sessionId: string): FakeEntrySession | undefined {
    return this.sessions.find((session) => session.sessionId === sessionId);
  }

  findExpired(window: OpeningWindow): Promise<readonly ExpiredEntry[]> {
    const expired = this.sessions.filter((session) => session.state === 'CREATED' && session.openedMillisecondsAgo > window.withinMilliseconds);
    return Promise.resolve(expired.map((session) => ({ sessionId: session.sessionId, lotId: LOT_ID })));
  }

  cancel(entry: ExpiredEntry): Promise<boolean> {
    if (this.failingCancels.has(entry.sessionId)) {
      return Promise.reject(new Error('deadlock detected'));
    }
    this.beforeCancel(entry.sessionId);
    const session = this.session(entry.sessionId);
    if (session?.state !== 'CREATED') {
      return Promise.resolve(false);
    }
    session.state = 'CANCELLED';
    session.holdReleasePending = session.paymentIntentId !== null;
    this.freedSpots.push(session.spot);
    return Promise.resolve(true);
  }

  claimPendingReleases(limit: number): Promise<readonly PendingRelease[]> {
    const claimed = this.#pendingHolds()
      .sort((left, right) => this.#lastAttemptOf(left) - this.#lastAttemptOf(right))
      .slice(0, limit);
    for (const session of claimed) {
      session.releaseAttempts += 1;
      this.#lastAttempt.set(session.sessionId, (this.#attemptSequence += 1));
    }
    return Promise.resolve(claimed.map((session) => ({ sessionId: session.sessionId, paymentIntentId: session.paymentIntentId ?? '' })));
  }

  markReleased(sessionId: string): Promise<void> {
    const session = this.session(sessionId);
    if (session !== undefined) {
      session.holdReleasePending = false;
    }
    return Promise.resolve();
  }

  countPendingReleases(): Promise<number> {
    return Promise.resolve(this.#pendingHolds().length);
  }

  #pendingHolds(): FakeEntrySession[] {
    return this.sessions.filter((session) => session.holdReleasePending && session.paymentIntentId !== null);
  }

  // Never attempted sorts first, like nulls first in SQL.
  #lastAttemptOf(session: FakeEntrySession): number {
    return this.#lastAttempt.get(session.sessionId) ?? 0;
  }
}

export function recordingLog(): JobLog & { readonly lines: { level: string; details: object; message: string }[] } {
  const lines: { level: string; details: object; message: string }[] = [];
  const write = (level: string) => (details: object, message: string) => void lines.push({ level, details, message });
  return { lines, info: write('info'), warn: write('warn'), error: write('error') };
}
