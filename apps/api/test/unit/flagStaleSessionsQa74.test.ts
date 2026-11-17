import { describe, expect, it, vi } from 'vitest';
import { flagStaleSessions, type StaleSessionJob } from '../../src/domain/parkingSessions/flagStaleSessions.ts';
import { lastProofOf } from '../../src/domain/parkingSessions/sessionProofs.ts';
import { FakeStaleSessionRepository, type FakeStaleSession } from './fakes/fakeStaleSessions.ts';

const HOUR = 3_600_000;
const ENTRY_CONFIRMED_AT = new Date('2026-11-16T01:15:00.493Z');

function at(start: Date, milliseconds: number): Date {
  return new Date(start.getTime() + milliseconds);
}

function silentLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function jobAt(staleSessions: StaleSessionJob['staleSessions'], now: Date): StaleSessionJob {
  return { staleSessions, clock: () => now };
}

function onlySession(session: FakeStaleSession): FakeStaleSessionRepository {
  const staleSessions = new FakeStaleSessionRepository();
  staleSessions.sessions.push(session);
  return staleSessions;
}

// Marc on the lane: entry confirmed, silent, then the silence job presumed him parked 55 minutes later (TIMEOUT stamps the job's clock).
const marcPresumedBySilence = (): FakeStaleSession => ({
  state: 'PARKED_PRESUMED',
  entryConfirmedAt: ENTRY_CONFIRMED_AT,
  parkedAt: at(ENTRY_CONFIRMED_AT, 55 * 60_000),
  presumedBy: 'TIMEOUT',
  parkedAnsweredAt: null,
  presenceConfirmedAt: null,
  staleFlaggedAt: null,
});

describe('QA #74: proofs and the 7 day cut, attacked', () => {
  it('flags at 7 days after the entry even though a timeout presumption is younger than 7 days', async () => {
    const marc = marcPresumedBySilence();
    const now = at(ENTRY_CONFIRMED_AT, 168 * HOUR);

    await flagStaleSessions(jobAt(onlySession(marc), now), silentLog());

    expect(marc.staleFlaggedAt).toEqual(now);
    expect(lastProofOf(marc)).toEqual({ at: ENTRY_CONFIRMED_AT, kind: 'ENTRY' });
  });

  it('does not take a wrong-aisle walk waiting for an answer (no presumption yet) as a proof', () => {
    const asked: FakeStaleSession = { ...marcPresumedBySilence(), state: 'PARKED_UNCONFIRMED', presumedBy: null };

    expect(lastProofOf(asked)).toEqual({ at: ENTRY_CONFIRMED_AT, kind: 'ENTRY' });
  });

  it('has the entry as last proof when a walk is recorded without its instant', () => {
    expect(lastProofOf({ ...marcPresumedBySilence(), presumedBy: 'WALK', parkedAt: null })).toEqual({ at: ENTRY_CONFIRMED_AT, kind: 'ENTRY' });
  });

  it('flags again exactly 168 hours after the presence check, and not a millisecond before', async () => {
    const confirmedAt = new Date('2026-11-16T02:10:52.000Z');
    const julie: FakeStaleSession = {
      state: 'PARKED_PRESUMED',
      entryConfirmedAt: new Date('2026-11-09T02:10:44.261Z'),
      parkedAt: new Date('2026-11-09T02:10:51.999Z'),
      presumedBy: 'WALK',
      parkedAnsweredAt: null,
      presenceConfirmedAt: confirmedAt,
      staleFlaggedAt: null,
    };
    const staleSessions = onlySession(julie);

    await flagStaleSessions(jobAt(staleSessions, at(confirmedAt, 168 * HOUR - 1)), silentLog());
    expect(julie.staleFlaggedAt).toBeNull();

    await flagStaleSessions(jobAt(staleSessions, at(confirmedAt, 168 * HOUR)), silentLog());
    expect(julie.staleFlaggedAt).toEqual(at(confirmedAt, 168 * HOUR));
    expect(lastProofOf(julie)?.kind).toBe('PRESENCE');
  });

  it('never flags a CREATED session, however old its scan, nor an entry cancelled before its loop', async () => {
    const scanned: FakeStaleSession = { ...marcPresumedBySilence(), state: 'CREATED', entryConfirmedAt: null, parkedAt: null, presumedBy: null };
    const cancelled: FakeStaleSession = { ...scanned, state: 'CANCELLED' };
    const staleSessions = new FakeStaleSessionRepository();
    staleSessions.sessions.push(scanned, cancelled);

    await flagStaleSessions(jobAt(staleSessions, at(ENTRY_CONFIRMED_AT, 365 * 24 * HOUR)), silentLog());

    expect(staleSessions.sessions.map(({ staleFlaggedAt }) => staleFlaggedAt)).toEqual([null, null]);
    expect(staleSessions.checks).toEqual([]);
  });
});
