import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardStaleSessions } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { TestClock } from '../../src/domain/time/TestClock.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeReviewedSession, FakeStaleSessionReviewRepository } from './fakes/fakeStaleSessionReviewRepository.ts';

const ENTERED_AT = new Date('2026-11-01T09:00:00Z');
const FLAGGED_AT = new Date('2026-11-08T09:00:00Z');
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
    proofs: { entryConfirmedAt: ENTERED_AT, parkedAt: new Date('2026-11-01T09:30:00Z'), presumedBy: 'TIMEOUT', parkedAnsweredAt: null, presenceConfirmedAt: null },
    staleFlaggedAt: FLAGGED_AT,
    presenceConfirmedBy: null,
    events: [],
    ...overrides,
  };
}

describe('the sessions with no exit for 7 days', () => {
  let server: FastifyInstance;
  let reviews: FakeStaleSessionReviewRepository;
  let testClock: TestClock | undefined;
  let sophieCookies: Record<string, string>;
  let pierreCookies: Record<string, string>;

  beforeEach(async () => {
    ({ server, staleSessionReviews: reviews, testClock } = startDashboardServer());
    sophieCookies = await dashboardCookieFor(server, sophie);
    pierreCookies = await dashboardCookieFor(server, pierre);
  });

  afterEach(() => server.close());

  const list = (cookies: Record<string, string>, lotId = PARKING_DEMO_ID) => server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/stale-sessions`, cookies });
  const confirm = (cookies: Record<string, string>, sessionId: string, lotId = PARKING_DEMO_ID) =>
    server.inject({ method: 'POST', url: `/v1/dashboard/lots/${lotId}/stale-sessions/${sessionId}/presence`, cookies, headers: writeHeader });

  it('AC1: lists a flagged session with its spot, its last known proof and its flag time', async () => {
    reviews.sessions.push(flaggedSession());

    const response = await list(sophieCookies);

    expect(response.statusCode).toBe(200);
    expect(response.json<DashboardStaleSessions>()).toEqual({
      lotName: 'Parking Démo',
      sessions: [
        {
          id: reviews.sessions[0]?.id,
          plate: 'ABC 123',
          spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
          lastProofAt: ENTERED_AT.toISOString(),
          lastProofKind: 'ENTRY',
          flaggedAt: FLAGGED_AT.toISOString(),
        },
      ],
    });
  });

  it('lists nothing for a session that is not flagged yet, one that left, or one of another lot', async () => {
    reviews.sessions.push(flaggedSession({ staleFlaggedAt: null }), flaggedSession({ state: 'CLOSED_PAID' }), flaggedSession({ lotId: UNKNOWN_ID }));

    expect((await list(sophieCookies)).json<DashboardStaleSessions>().sessions).toEqual([]);
  });

  it('lists the oldest flag first', async () => {
    const newer = flaggedSession({ staleFlaggedAt: new Date('2026-11-09T09:00:00Z') });
    const older = flaggedSession();
    reviews.sessions.push(newer, older);

    const ids = (await list(sophieCookies)).json<DashboardStaleSessions>().sessions.map(({ id }) => id);

    expect(ids).toEqual([older.id, newer.id]);
  });

  it('never shows who the driver is, how they paid or the member who checked', async () => {
    reviews.sessions.push(flaggedSession({ presenceConfirmedBy: sophie.id }));

    const body = (await list(sophieCookies)).body;

    expect(body).not.toContain(sophie.id);
    expect(Object.keys(JSON.parse(body).sessions[0]).sort()).toEqual(['flaggedAt', 'id', 'lastProofAt', 'lastProofKind', 'plate', 'spot']);
  });

  it('AC3: a presence check takes the session off the list, keeps it open and answers the rest of the list', async () => {
    const julie = flaggedSession();
    const marc = flaggedSession({ plate: 'XYZ 789', staleFlaggedAt: new Date('2026-11-09T09:00:00Z') });
    reviews.sessions.push(julie, marc);

    const response = await confirm(sophieCookies, julie.id);

    expect(response.statusCode).toBe(200);
    expect(response.json<DashboardStaleSessions>().sessions.map(({ plate }) => plate)).toEqual(['XYZ 789']);
    expect(julie).toMatchObject({ state: 'PARKED_PRESUMED', staleFlaggedAt: null, presenceConfirmedBy: sophie.id, events: ['PRESENCE_CONFIRMED'] });
    expect(julie.proofs.presenceConfirmedAt).toBeInstanceOf(Date);
  });

  it('dates the check by the dashboard clock, which is the test clock when it is active', async () => {
    const julie = flaggedSession();
    reviews.sessions.push(julie);
    testClock?.setFixed(new Date('2026-11-09T12:00:00Z'));

    await confirm(sophieCookies, julie.id);

    expect(julie.proofs.presenceConfirmedAt).toEqual(new Date('2026-11-09T12:00:00Z'));
  });

  it('answers a second click on the same session with the list, writing nothing more', async () => {
    const julie = flaggedSession();
    reviews.sessions.push(julie);

    await confirm(sophieCookies, julie.id);
    const second = await confirm(sophieCookies, julie.id);

    expect(second.statusCode).toBe(200);
    expect(julie.events).toEqual(['PRESENCE_CONFIRMED']);
  });

  it('refuses a closed session as not found', async () => {
    const left = flaggedSession({ state: 'CLOSED_PAID' });
    reviews.sessions.push(left);

    const response = await confirm(sophieCookies, left.id);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(SESSION_NOT_FOUND);
    expect(left.staleFlaggedAt).not.toBeNull();
  });

  it('refuses a session id that matches nothing, or is malformed, as the session not found', async () => {
    expect((await confirm(sophieCookies, UNKNOWN_ID)).json()).toEqual(SESSION_NOT_FOUND);
    expect((await confirm(sophieCookies, 'not-a-uuid')).json()).toEqual(SESSION_NOT_FOUND);
  });

  it('answers a busy lot with 503 and a retry hint, leaving the flag', async () => {
    const julie = flaggedSession();
    reviews.sessions.push(julie);
    reviews.busyLots.add(PARKING_DEMO_ID);

    const response = await confirm(sophieCookies, julie.id);

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'LOT_BUSY' });
    expect(julie.staleFlaggedAt).not.toBeNull();
  });

  it("AC4: gives Pierre Roy not found for Sophie's lot, on the list and on the check, and changes nothing", async () => {
    const julie = flaggedSession();
    reviews.sessions.push(julie);

    const read = await list(pierreCookies);
    const write = await confirm(pierreCookies, julie.id);

    expect([read.statusCode, read.json()]).toEqual([404, LOT_NOT_FOUND]);
    expect([write.statusCode, write.json()]).toEqual([404, LOT_NOT_FOUND]);
    expect(julie.staleFlaggedAt).not.toBeNull();
  });

  it('refuses a visitor without a session, and a check without the dashboard header', async () => {
    reviews.sessions.push(flaggedSession());

    expect((await list({})).statusCode).toBe(401);
    expect((await server.inject({ method: 'POST', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/stale-sessions/${UNKNOWN_ID}/presence`, cookies: sophieCookies })).statusCode).toBe(403);
  });

  it('answers a malformed lot id like a lot that matches nothing', async () => {
    expect((await list(sophieCookies, 'not-a-uuid')).json()).toEqual(LOT_NOT_FOUND);
  });
});
