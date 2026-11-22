import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardStaleSessions } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { TestClock } from '../../src/domain/time/TestClock.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeCardHoldCanceller } from './fakes/fakeCardHoldCanceller.ts';
import type { FakeReviewedSession, FakeStaleSessionReviewRepository } from './fakes/fakeStaleSessionReviewRepository.ts';

// The story's example: Julie entered on 3 March and walked to A-1 at 18 h 40 (Montréal), her last proof.
const ENTERED_AT = new Date('2026-03-03T23:30:00Z');
const PARKED_AT = new Date('2026-03-03T23:40:00Z');
const FLAGGED_AT = new Date('2026-03-10T23:40:00Z');
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000999';
const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };
const SESSION_NOT_FOUND = { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' };

let counter = 0;

function flaggedSession(overrides: Partial<FakeReviewedSession> = {}): FakeReviewedSession {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    lotId: PARKING_DEMO_ID,
    plate: 'ABC 123',
    state: 'PARKED_PRESUMED',
    spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
    proofs: { entryConfirmedAt: ENTERED_AT, parkedAt: PARKED_AT, presumedBy: 'WALK', parkedAnsweredAt: null, presenceConfirmedAt: null },
    staleFlaggedAt: FLAGGED_AT,
    presenceConfirmedBy: null,
    events: [],
    paymentIntentId: 'pi_julie',
    ...overrides,
  };
}

describe('closing a stale session at its last known proof (story #75)', () => {
  let server: FastifyInstance;
  let reviews: FakeStaleSessionReviewRepository;
  let cardHolds: FakeCardHoldCanceller;
  let testClock: TestClock | undefined;
  let sophieCookies: Record<string, string>;
  let pierreCookies: Record<string, string>;

  beforeEach(async () => {
    ({ server, staleSessionReviews: reviews, cardHolds, testClock } = startDashboardServer());
    sophieCookies = await dashboardCookieFor(server, sophie);
    pierreCookies = await dashboardCookieFor(server, pierre);
  });

  afterEach(() => server.close());

  const close = (cookies: Record<string, string>, sessionId: string, headers: Record<string, string> = writeHeader) =>
    server.inject({ method: 'POST', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/stale-sessions/${sessionId}/close`, cookies, headers });

  function julieParkedAtA1(): FakeReviewedSession {
    return flaggedSession();
  }

  it('AC1: closes the session at its last proof as a staff exit, and answers the list without it', async () => {
    const julie = julieParkedAtA1();
    const marc = flaggedSession({ plate: 'XYZ 789', staleFlaggedAt: new Date('2026-03-11T09:00:00Z') });
    reviews.sessions.push(julie, marc);

    const response = await close(sophieCookies, julie.id);

    expect(response.statusCode).toBe(200);
    expect(response.json<DashboardStaleSessions>().sessions.map(({ plate }) => plate)).toEqual(['XYZ 789']);
    expect(julie).toMatchObject({ state: 'CLOSED_BY_STAFF', exitAt: PARKED_AT, staffClosedBy: sophie.id, events: ['CLOSED_BY_STAFF'] });
  });

  it('AC2: cancels the card hold after the closing and captures nothing', async () => {
    const julie = julieParkedAtA1();
    reviews.sessions.push(julie);

    await close(sophieCookies, julie.id);

    expect(cardHolds.cancelled).toEqual(['pi_julie']);
  });

  it('AC2: still answers the closing when Stripe cannot be reached, the hold left to the release job', async () => {
    const julie = julieParkedAtA1();
    reviews.sessions.push(julie);
    cardHolds.failure = new Error('Stripe is down');

    const response = await close(sophieCookies, julie.id);

    expect(response.statusCode).toBe(200);
    expect(julie).toMatchObject({ state: 'CLOSED_BY_STAFF', holdReleasePending: true });
  });

  it('closes at the last proof whatever the clock says, the test clock included', async () => {
    const julie = julieParkedAtA1();
    reviews.sessions.push(julie);
    testClock?.setFixed(new Date('2026-11-20T12:00:00Z'));

    await close(sophieCookies, julie.id);

    expect(julie.exitAt).toEqual(PARKED_AT);
  });

  it('refuses a session no longer open or no longer flagged as not found, and a second click the same way', async () => {
    const julie = julieParkedAtA1();
    const checked = flaggedSession({ staleFlaggedAt: null });
    reviews.sessions.push(julie, checked);

    await close(sophieCookies, julie.id);
    const second = await close(sophieCookies, julie.id);
    const unflagged = await close(sophieCookies, checked.id);

    expect([second.statusCode, second.json()]).toEqual([404, SESSION_NOT_FOUND]);
    expect([unflagged.statusCode, unflagged.json()]).toEqual([404, SESSION_NOT_FOUND]);
    expect(julie.events).toEqual(['CLOSED_BY_STAFF']);
    expect(cardHolds.cancelled).toEqual(['pi_julie']);
  });

  it('refuses an unknown or malformed session id as the session not found', async () => {
    expect((await close(sophieCookies, UNKNOWN_ID)).json()).toEqual(SESSION_NOT_FOUND);
    expect((await close(sophieCookies, 'not-a-uuid')).json()).toEqual(SESSION_NOT_FOUND);
  });

  it('answers a busy lot with 503, leaving the session open', async () => {
    const julie = julieParkedAtA1();
    reviews.sessions.push(julie);
    reviews.busyLots.add(PARKING_DEMO_ID);

    const response = await close(sophieCookies, julie.id);

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'LOT_BUSY' });
    expect(julie.state).toBe('PARKED_PRESUMED');
  });

  it("AC3: gives Pierre Roy not found for Julie's session and changes nothing", async () => {
    const julie = julieParkedAtA1();
    reviews.sessions.push(julie);

    const response = await close(pierreCookies, julie.id);

    expect([response.statusCode, response.json()]).toEqual([404, LOT_NOT_FOUND]);
    expect(julie).toMatchObject({ state: 'PARKED_PRESUMED', staleFlaggedAt: FLAGGED_AT, events: [] });
    expect(cardHolds.cancelled).toEqual([]);
  });

  it('refuses a visitor without a session, and a closing without the dashboard header', async () => {
    const julie = julieParkedAtA1();
    reviews.sessions.push(julie);

    expect((await close({}, julie.id)).statusCode).toBe(401);
    expect((await close(sophieCookies, julie.id, {})).statusCode).toBe(403);
    expect(julie.state).toBe('PARKED_PRESUMED');
  });
});
