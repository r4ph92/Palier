import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JobLog } from '../../src/domain/JobLog.ts';
import { DashboardRefusedError } from '../../src/domain/dashboard/DashboardRefusedError.ts';
import { closeAtLastProofOfMember } from '../../src/domain/dashboard/staleSessions.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { FakeCardHoldCanceller } from './fakes/fakeCardHoldCanceller.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';
import { FakeStaleSessionReviewRepository, type FakeReviewedSession } from './fakes/fakeStaleSessionReviewRepository.ts';

const NOW = new Date('2026-11-12T10:30:00Z');
const PARKED_AT = new Date('2026-03-03T23:40:00Z');
const SESSION_ID = '00000000-0000-4000-8000-000000000751';

function julieFlagged(overrides: Partial<FakeReviewedSession> = {}): FakeReviewedSession {
  return {
    id: SESSION_ID,
    lotId: PARKING_DEMO_ID,
    plate: 'ABC 123',
    state: 'PARKED_PRESUMED',
    spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
    proofs: { entryConfirmedAt: new Date('2026-03-03T23:30:00Z'), parkedAt: PARKED_AT, presumedBy: 'WALK', parkedAnsweredAt: null, presenceConfirmedAt: null },
    staleFlaggedAt: new Date('2026-03-10T23:40:00Z'),
    presenceConfirmedBy: null,
    events: [],
    paymentIntentId: 'pi_julie',
    ...overrides,
  };
}

class RecordingLog implements JobLog {
  readonly lines: { level: string; details: object; message: string }[] = [];
  info(details: object, message: string): void {
    this.lines.push({ level: 'info', details, message });
  }
  warn(details: object, message: string): void {
    this.lines.push({ level: 'warn', details, message });
  }
  error(details: object, message: string): void {
    this.lines.push({ level: 'error', details, message });
  }
}

function setup(session: FakeReviewedSession = julieFlagged()) {
  const operators = new FakeOperatorRepository();
  const staleSessions = new FakeStaleSessionReviewRepository(operators.lots);
  staleSessions.sessions.push(session);
  const holds = new FakeCardHoldCanceller();
  const log = new RecordingLog();
  const close = (userId = sophie.id, sessionId = SESSION_ID) =>
    closeAtLastProofOfMember({ operators, staleSessions, holds, clock: () => NOW }, { userId, lotId: PARKING_DEMO_ID, sessionId }, log);
  return { session, holds, log, close, staleSessions };
}

describe('closing a stale session at its last proof as a member (story #75)', () => {
  it('closes the session at its last proof by staff, takes it off the list and logs the step', async () => {
    const { session, close } = setup();

    const answer = await close();

    expect(answer).toEqual({ lotName: 'Parking Démo', sessions: [] });
    expect(session).toMatchObject({ state: 'CLOSED_BY_STAFF', exitAt: PARKED_AT, staffClosedBy: sophie.id, staleFlaggedAt: null, events: ['CLOSED_BY_STAFF'] });
  });

  it('cancels the card hold once the session is closed, and captures nothing', async () => {
    const { session, holds, close } = setup();

    await close();

    expect(holds.cancelled).toEqual(['pi_julie']);
    expect(session.holdReleasePending).toBe(true);
  });

  it.each([
    ['Stripe answers it cannot release the hold', (holds: FakeCardHoldCanceller) => {
        holds.answer = 'failed';
      }, 'warn'],
    ['Stripe cannot be reached', (holds: FakeCardHoldCanceller) => {
        holds.failure = new Error('Stripe is down');
      }, 'error'],
  ] as const)('keeps the session closed and leaves the hold to the release job when %s', async (_case, breakStripe, level) => {
    const { session, holds, log, close } = setup();
    breakStripe(holds);

    expect((await close()).sessions).toEqual([]);
    expect(session).toMatchObject({ state: 'CLOSED_BY_STAFF', holdReleasePending: true });
    expect(log.lines.map((line) => line.level)).toEqual([level]);
    expect(JSON.stringify(log.lines)).not.toContain('pi_julie');
  });

  it('closes a session without a hold, and a session on a server without a Stripe key, calling no one', async () => {
    const noHold = setup(julieFlagged({ paymentIntentId: null }));
    await noHold.close();
    expect(noHold.holds.cancelled).toEqual([]);

    const operators = new FakeOperatorRepository();
    const staleSessions = new FakeStaleSessionReviewRepository(operators.lots);
    const julie = julieFlagged();
    staleSessions.sessions.push(julie);
    await closeAtLastProofOfMember({ operators, staleSessions, holds: null, clock: () => NOW }, { userId: sophie.id, lotId: PARKING_DEMO_ID, sessionId: SESSION_ID }, new RecordingLog());
    expect(julie).toMatchObject({ state: 'CLOSED_BY_STAFF', holdReleasePending: true });
  });

  it.each([
    ['no longer active', julieFlagged({ state: 'CLOSED_PAID' })],
    ['no longer flagged', julieFlagged({ staleFlaggedAt: null })],
  ])('refuses a session %s as SESSION_NOT_FOUND, cancelling nothing', async (_case, session) => {
    const { holds, close } = setup(session);

    await expect(close()).rejects.toEqual(new DashboardRefusedError('SESSION_NOT_FOUND'));
    expect(holds.cancelled).toEqual([]);
  });

  it('refuses a busy lot as LOT_BUSY, leaving the session open', async () => {
    const { session, staleSessions, holds, close } = setup();
    staleSessions.busyLots.add(PARKING_DEMO_ID);

    await expect(close()).rejects.toEqual(new DashboardRefusedError('LOT_BUSY'));
    expect(session.state).toBe('PARKED_PRESUMED');
    expect(holds.cancelled).toEqual([]);
  });

  it("gives Pierre Roy not found for Sophie's lot and changes nothing", async () => {
    const { session, holds, close } = setup();

    await expect(close(pierre.id)).rejects.toEqual(new DashboardRefusedError('LOT_NOT_FOUND'));
    expect(session).toMatchObject({ state: 'PARKED_PRESUMED', events: [] });
    expect(holds.cancelled).toEqual([]);
  });
});

describe('the staff closing and the payments', () => {
  const CLOSING_FILES = [
    '../../src/domain/dashboard/staleSessions.ts',
    '../../src/domain/dashboard/CardHoldCanceller.ts',
    '../../src/domain/dashboard/StaleSessionReviewRepository.ts',
    '../../src/infrastructure/postgres/PostgresStaleSessionReviewRepository.ts',
    '../../src/infrastructure/postgres/staleSessionReviewStatements.ts',
    '../../src/infrastructure/postgres/sessionSpotRelease.ts',
    '../../src/http/dashboard/dashboardStaleSessionRoutes.ts',
  ];

  it.each(CLOSING_FILES)('%s imports no capture, payment authorizer or Stripe code, so the closing can never capture', (file) => {
    const imports = readFileSync(new URL(file, import.meta.url), 'utf8').split('\n').filter((line) => line.startsWith('import '));

    expect(imports.filter((line) => /capture|stripe|PaymentAuthorizer|exitParking|takePayment/i.test(line))).toEqual([]);
  });
});
