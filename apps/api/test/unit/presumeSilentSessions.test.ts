import { describe, expect, it, vi } from 'vitest';
import { LotBusyError } from '../../src/domain/lots/LotBusyError.ts';
import { presumeSilentSessions, type SilentSessionJob } from '../../src/domain/parkingSessions/presumeSilentSessions.ts';
import { FakeSilentSessionRepository, type FakeSilentSession } from './fakes/fakeSilentSessions.ts';

const ENTERED_AT = new Date('2026-11-04T19:00:00Z');
const AFTER_30_MINUTES = new Date('2026-11-04T19:30:00Z');
const AFTER_29_MINUTES = new Date('2026-11-04T19:29:00Z');

function logSpy() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function repositoryWith(session: FakeSilentSession): FakeSilentSessionRepository {
  const silentSessions = new FakeSilentSessionRepository();
  silentSessions.sessions.push(session);
  return silentSessions;
}

function jobAt(silentSessions: SilentSessionJob['silentSessions'], now: Date): SilentSessionJob {
  return { silentSessions, clock: () => now };
}

const julieEntered = (): FakeSilentSession => ({ state: 'ENTRY_CONFIRMED', entryConfirmedAt: ENTERED_AT, presumedBy: null });
const julieAsked = (): FakeSilentSession => ({ state: 'PARKED_UNCONFIRMED', parkedAt: ENTERED_AT, presumedBy: null });

describe('presumeSilentSessions', () => {
  it('C1: asks the repository to presume a session entered 30 minutes ago and logs only the counts', async () => {
    const silentSessions = repositoryWith(julieEntered());
    const log = logSpy();

    await presumeSilentSessions(jobAt(silentSessions, AFTER_30_MINUTES), log);

    expect(silentSessions.presumptions).toHaveLength(1);
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-demo', confirmedEntries: 1, unansweredQuestions: 0 }, expect.any(String));
  });

  it('C2: leaves a session entered 29 minutes ago alone and does not even open a lot', async () => {
    const silentSessions = repositoryWith(julieEntered());
    const log = logSpy();

    await presumeSilentSessions(jobAt(silentSessions, AFTER_29_MINUTES), log);

    expect(silentSessions.sessions[0]?.presumedBy).toBeNull();
    expect(silentSessions.presumptions).toEqual([]);
    expect(log.info).not.toHaveBeenCalled();
  });

  it('C3: presumes a driver asked where they parked 30 minutes ago who never answered', async () => {
    const silentSessions = repositoryWith(julieAsked());
    const log = logSpy();

    await presumeSilentSessions(jobAt(silentSessions, AFTER_30_MINUTES), log);

    expect(silentSessions.sessions[0]?.presumedBy).toBe('TIMEOUT');
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-demo', confirmedEntries: 0, unansweredQuestions: 1 }, expect.any(String));
  });

  it('C3: leaves a question asked 29 minutes ago waiting for its answer', async () => {
    const silentSessions = repositoryWith(julieAsked());

    await presumeSilentSessions(jobAt(silentSessions, AFTER_29_MINUTES), logSpy());

    expect(silentSessions.sessions[0]?.presumedBy).toBeNull();
  });

  it('reads the clock once and cuts 30 minutes before that reading', async () => {
    const silentSessions = repositoryWith(julieEntered());
    const clock = vi.fn(() => AFTER_30_MINUTES);

    await presumeSilentSessions({ silentSessions, clock }, logSpy());

    expect(clock).toHaveBeenCalledTimes(1);
    expect(silentSessions.presumptions).toEqual([{ lotId: 'lot-demo', cutoff: ENTERED_AT, now: AFTER_30_MINUTES }]);
  });

  it('logs the failure of one lot with its id and still presumes the next lot', async () => {
    const failure = new Error('connection reset');
    const silentSessions: SilentSessionJob['silentSessions'] = {
      findLotsWithSilentSessions: () => Promise.resolve(['lot-busy', 'lot-calm']),
      presumeLotSilentSessions: (lotId) =>
        lotId === 'lot-busy' ? Promise.reject(failure) : Promise.resolve({ confirmedEntries: 2, unansweredQuestions: 0 }),
    };
    const log = logSpy();

    await presumeSilentSessions(jobAt(silentSessions, AFTER_30_MINUTES), log);

    expect(log.error).toHaveBeenCalledExactlyOnceWith({ err: failure, lotId: 'lot-busy' }, expect.stringContaining('retried at the next check'));
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-calm', confirmedEntries: 2, unansweredQuestions: 0 }, expect.any(String));
  });

  it('warns with the lot id and no stack when a lot is busy, and still presumes the next one', async () => {
    const silentSessions: SilentSessionJob['silentSessions'] = {
      findLotsWithSilentSessions: () => Promise.resolve(['lot-busy', 'lot-calm']),
      presumeLotSilentSessions: (lotId) =>
        lotId === 'lot-busy' ? Promise.reject(new LotBusyError(lotId)) : Promise.resolve({ confirmedEntries: 1, unansweredQuestions: 0 }),
    };
    const log = logSpy();

    await presumeSilentSessions(jobAt(silentSessions, AFTER_30_MINUTES), log);

    expect(log.warn).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-busy' }, expect.stringContaining('retried at the next check'));
    expect(log.error).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledOnce();
  });

  it('stays silent when a concurrent run already presumed everything', async () => {
    const silentSessions: SilentSessionJob['silentSessions'] = {
      findLotsWithSilentSessions: () => Promise.resolve(['lot-demo']),
      presumeLotSilentSessions: () => Promise.resolve({ confirmedEntries: 0, unansweredQuestions: 0 }),
    };
    const log = logSpy();

    await presumeSilentSessions(jobAt(silentSessions, AFTER_30_MINUTES), log);

    expect(log.info).not.toHaveBeenCalled();
  });
});
