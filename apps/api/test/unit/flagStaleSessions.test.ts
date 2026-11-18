import { describe, expect, it, vi } from 'vitest';
import { LotBusyError } from '../../src/domain/lots/LotBusyError.ts';
import { flagStaleSessions, type StaleSessionJob } from '../../src/domain/parkingSessions/flagStaleSessions.ts';
import { MILLISECONDS_PER_HOUR } from '../../src/domain/time/durations.ts';
import { FakeStaleSessionRepository, type FakeStaleSession } from './fakes/fakeStaleSessions.ts';

const ENTERED_AT = new Date('2026-11-01T09:00:00Z');

function after(start: Date, hours: number): Date {
  return new Date(start.getTime() + hours * MILLISECONDS_PER_HOUR);
}

function logSpy() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function jobAt(staleSessions: StaleSessionJob['staleSessions'], now: Date): StaleSessionJob {
  return { staleSessions, clock: () => now };
}

function repositoryWith(session: FakeStaleSession): FakeStaleSessionRepository {
  const staleSessions = new FakeStaleSessionRepository();
  staleSessions.sessions.push(session);
  return staleSessions;
}

const julieParked = (): FakeStaleSession => ({
  state: 'PARKED_PRESUMED',
  entryConfirmedAt: ENTERED_AT,
  parkedAt: after(ENTERED_AT, 0.1),
  presumedBy: 'TIMEOUT',
  parkedAnsweredAt: null,
  presenceConfirmedAt: null,
  staleFlaggedAt: null,
});

describe('flagStaleSessions', () => {
  it('AC1: flags Julie after 7 days without an exit and logs only the count', async () => {
    const staleSessions = repositoryWith(julieParked());
    const log = logSpy();

    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 168)), log);

    expect(staleSessions.sessions[0]?.staleFlaggedAt).toEqual(after(ENTERED_AT, 168));
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-demo', flagged: 1 }, expect.any(String));
  });

  it('AC2: leaves a session with no exit for 6 days 23 hours unflagged and opens no lot', async () => {
    const staleSessions = repositoryWith(julieParked());

    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 167)), logSpy());

    expect(staleSessions.sessions[0]?.staleFlaggedAt).toBeNull();
    expect(staleSessions.checks).toEqual([]);
  });

  it('does not count a timeout presumption as a proof: the entry is the last one', async () => {
    const staleSessions = repositoryWith({ ...julieParked(), parkedAt: after(ENTERED_AT, 160) });

    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 168)), logSpy());

    expect(staleSessions.sessions[0]?.staleFlaggedAt).not.toBeNull();
  });

  it('counts a walk to the spot as a proof', async () => {
    const staleSessions = repositoryWith({ ...julieParked(), presumedBy: 'WALK', parkedAt: after(ENTERED_AT, 100) });

    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 168)), logSpy());

    expect(staleSessions.sessions[0]?.staleFlaggedAt).toBeNull();
  });

  it('counts the driver answer as a proof', async () => {
    const staleSessions = repositoryWith({ ...julieParked(), state: 'PARKED_CONFIRMED', parkedAnsweredAt: after(ENTERED_AT, 120) });

    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 168)), logSpy());

    expect(staleSessions.sessions[0]?.staleFlaggedAt).toBeNull();
  });

  it('never flags a session whose entry was not confirmed, nor a closed one', async () => {
    const created: FakeStaleSession = { ...julieParked(), state: 'CREATED', entryConfirmedAt: null, parkedAt: null };
    const closed: FakeStaleSession = { ...julieParked(), state: 'CLOSED_PAID' };
    const staleSessions = new FakeStaleSessionRepository();
    staleSessions.sessions.push(created, closed);

    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 1000)), logSpy());

    expect(staleSessions.sessions.map(({ staleFlaggedAt }) => staleFlaggedAt)).toEqual([null, null]);
  });

  it('flags a session exactly 7 days old and not one a millisecond younger', async () => {
    const atLimit = repositoryWith(julieParked());
    const justYounger = repositoryWith({ ...julieParked(), entryConfirmedAt: new Date(ENTERED_AT.getTime() + 1), parkedAt: null });

    await flagStaleSessions(jobAt(atLimit, after(ENTERED_AT, 168)), logSpy());
    await flagStaleSessions(jobAt(justYounger, after(ENTERED_AT, 168)), logSpy());

    expect(atLimit.sessions[0]?.staleFlaggedAt).not.toBeNull();
    expect(justYounger.sessions[0]?.staleFlaggedAt).toBeNull();
  });

  it('flags a session once: a second run finds nothing new and stays silent', async () => {
    const staleSessions = repositoryWith(julieParked());
    const log = logSpy();

    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 168)), logSpy());
    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 169)), log);

    expect(staleSessions.sessions[0]?.staleFlaggedAt).toEqual(after(ENTERED_AT, 168));
    expect(log.info).not.toHaveBeenCalled();
  });

  it('AC3: flags the session again 7 days after the presence was confirmed, not before', async () => {
    const julie = julieParked();
    const staleSessions = repositoryWith(julie);
    await flagStaleSessions(jobAt(staleSessions, after(ENTERED_AT, 168)), logSpy());
    const confirmedAt = after(ENTERED_AT, 170);
    staleSessions.confirmPresence(julie, confirmedAt);

    await flagStaleSessions(jobAt(staleSessions, after(confirmedAt, 167)), logSpy());
    expect(julie.staleFlaggedAt).toBeNull();

    await flagStaleSessions(jobAt(staleSessions, after(confirmedAt, 168)), logSpy());
    expect(julie.staleFlaggedAt).toEqual(after(confirmedAt, 168));
  });

  it('reads the clock once and cuts 168 hours before that reading', async () => {
    const staleSessions = repositoryWith(julieParked());
    const clock = vi.fn(() => after(ENTERED_AT, 168));

    await flagStaleSessions({ staleSessions, clock }, logSpy());

    expect(clock).toHaveBeenCalledTimes(1);
    expect(staleSessions.checks).toEqual([{ lotId: 'lot-demo', cutoff: ENTERED_AT, now: after(ENTERED_AT, 168) }]);
  });

  it('logs the failure of one lot with its id and still flags the next lot', async () => {
    const failure = new Error('connection reset');
    const staleSessions: StaleSessionJob['staleSessions'] = {
      findLotsWithStaleSessions: () => Promise.resolve(['lot-broken', 'lot-calm']),
      flagLotStaleSessions: (lotId) => (lotId === 'lot-broken' ? Promise.reject(failure) : Promise.resolve(2)),
    };
    const log = logSpy();

    await flagStaleSessions(jobAt(staleSessions, ENTERED_AT), log);

    expect(log.error).toHaveBeenCalledExactlyOnceWith({ err: failure, lotId: 'lot-broken' }, expect.stringContaining('retried at the next check'));
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-calm', flagged: 2 }, expect.any(String));
  });

  it('warns without a stack when a lot is busy', async () => {
    const staleSessions: StaleSessionJob['staleSessions'] = {
      findLotsWithStaleSessions: () => Promise.resolve(['lot-busy']),
      flagLotStaleSessions: (lotId) => Promise.reject(new LotBusyError(lotId)),
    };
    const log = logSpy();

    await flagStaleSessions(jobAt(staleSessions, ENTERED_AT), log);

    expect(log.warn).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-busy' }, expect.stringContaining('retried at the next check'));
    expect(log.error).not.toHaveBeenCalled();
  });
});
