import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardStaleSessions } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../src/seed/fixtures/parkingTestPaliers.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeReviewedSession, FakeStaleSessionReviewRepository } from './fakes/fakeStaleSessionReviewRepository.ts';

const JULIE_SESSION_ID = '00000000-0000-4000-8000-000000007401';
const MARC_SESSION_ID = '00000000-0000-4000-8000-000000007402';
const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };
const SESSION_NOT_FOUND = { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' };

function julieFlagged(overrides: Partial<FakeReviewedSession> = {}): FakeReviewedSession {
  return {
    id: JULIE_SESSION_ID,
    lotId: PARKING_DEMO_ID,
    plate: 'ABC 123',
    state: 'PARKED_PRESUMED',
    spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
    proofs: { entryConfirmedAt: new Date('2026-11-09T02:10:44Z'), parkedAt: new Date('2026-11-09T02:10:52Z'), presumedBy: 'WALK', parkedAnsweredAt: null, presenceConfirmedAt: null },
    staleFlaggedAt: new Date('2026-11-16T02:10:52Z'),
    presenceConfirmedBy: null,
    events: [],
    ...overrides,
  };
}

describe('QA #74: the sessions with no exit, attacked through the routes', () => {
  let server: FastifyInstance;
  let reviews: FakeStaleSessionReviewRepository;
  let cookies: Record<'sophie' | 'pierre' | 'nouvel', Record<string, string>>;

  beforeEach(async () => {
    ({ server, staleSessionReviews: reviews } = startDashboardServer());
    cookies = {
      sophie: await dashboardCookieFor(server, sophie),
      pierre: await dashboardCookieFor(server, pierre),
      nouvel: await dashboardCookieFor(server, nouvelOperateur),
    };
  });

  afterEach(() => server.close());

  const list = (who: Record<string, string>, lotId = PARKING_DEMO_ID) => server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/stale-sessions`, cookies: who });
  const confirm = (who: Record<string, string>, sessionId: string, lotId = PARKING_DEMO_ID) =>
    server.inject({ method: 'POST', url: `/v1/dashboard/lots/${lotId}/stale-sessions/${sessionId}/presence`, cookies: who, headers: writeHeader });

  it("AC4: refuses Pierre the check of Sophie's session through his own lot as an unknown session, keeping the flag", async () => {
    const julie = julieFlagged();
    reviews.sessions.push(julie);

    const response = await confirm(cookies.pierre, julie.id, GARAGE_ROY_ID);

    expect([response.statusCode, response.json()]).toEqual([404, SESSION_NOT_FOUND]);
    expect(julie).toMatchObject({ staleFlaggedAt: julie.staleFlaggedAt, presenceConfirmedBy: null, events: [] });
  });

  it('gives an operator member with no lot not found on the list and on the check', async () => {
    const julie = julieFlagged();
    reviews.sessions.push(julie);

    expect([(await list(cookies.nouvel)).statusCode, (await list(cookies.nouvel)).json()]).toEqual([404, LOT_NOT_FOUND]);
    expect((await confirm(cookies.nouvel, julie.id)).json()).toEqual(LOT_NOT_FOUND);
    expect(julie.events).toEqual([]);
  });

  it("refuses Sophie the check of a session of her other lot addressed through Parking Démo's id", async () => {
    const paliers = julieFlagged({ lotId: PARKING_TEST_PALIERS_ID });
    reviews.sessions.push(paliers);

    expect((await confirm(cookies.sophie, paliers.id)).json()).toEqual(SESSION_NOT_FOUND);
    expect(paliers.events).toEqual([]);
    expect((await list(cookies.sophie)).json<DashboardStaleSessions>().sessions).toEqual([]);
  });

  it('logs one PRESENCE_CONFIRMED for two checks sent in the same instant (double click)', async () => {
    const julie = julieFlagged();
    reviews.sessions.push(julie);

    const answers = await Promise.all([confirm(cookies.sophie, julie.id), confirm(cookies.sophie, julie.id)]);

    expect(answers.map(({ statusCode }) => statusCode)).toEqual([200, 200]);
    expect(julie.events).toEqual(['PRESENCE_CONFIRMED']);
  });

  it('exit while flagged: the session leaves the list and a check from a stale page is refused as not found', async () => {
    const julie = julieFlagged();
    const marc = julieFlagged({ id: MARC_SESSION_ID, plate: 'XYZ 789' });
    reviews.sessions.push(julie, marc);
    const exited: FakeReviewedSession = { ...julie, state: 'CLOSED_PAID' };
    reviews.sessions.splice(0, 1, exited);

    const stalePageCheck = await confirm(cookies.sophie, julie.id);

    expect([stalePageCheck.statusCode, stalePageCheck.json()]).toEqual([404, SESSION_NOT_FOUND]);
    expect(exited.events).toEqual([]);
    expect((await list(cookies.sophie)).json<DashboardStaleSessions>().sessions.map(({ plate }) => plate)).toEqual(['XYZ 789']);
  });

  it('shows the PRESENCE proof once the check is done and the session is flagged again', async () => {
    const julie = julieFlagged();
    reviews.sessions.push(julie);
    await confirm(cookies.sophie, julie.id);
    julie.staleFlaggedAt = new Date('2026-11-23T02:10:52Z');

    const [row] = (await list(cookies.sophie)).json<DashboardStaleSessions>().sessions;

    expect(row).toMatchObject({ lastProofKind: 'PRESENCE', flaggedAt: '2026-11-23T02:10:52.000Z' });
    expect(row?.lastProofAt).toBe(julie.proofs.presenceConfirmedAt?.toISOString());
  });

  it.each([
    ['an SQL fragment', "'%20OR%201=1--"],
    ['a nil uuid', '00000000-0000-0000-0000-000000000000'],
    ['a 90 character id', 'a'.repeat(90)],
  ])('answers %s as session id like an unknown session, writing nothing', async (_label, sessionId) => {
    const julie = julieFlagged();
    reviews.sessions.push(julie);

    const response = await confirm(cookies.sophie, sessionId);

    expect([response.statusCode, response.json()]).toEqual([404, SESSION_NOT_FOUND]);
    expect(julie.events).toEqual([]);
  });

  it('refuses a 3000 character session id before any handler, writing nothing', async () => {
    const julie = julieFlagged();
    reviews.sessions.push(julie);

    const response = await confirm(cookies.sophie, 'a'.repeat(3000));

    expect(response.statusCode).toBe(414);
    expect(julie.events).toEqual([]);
  });

  it('ignores a forged body on the check: the member and the session come from the cookie and the path only', async () => {
    const julie = julieFlagged();
    reviews.sessions.push(julie);

    const response = await server.inject({
      method: 'POST',
      url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/stale-sessions/${julie.id}/presence`,
      cookies: cookies.sophie,
      headers: writeHeader,
      payload: { memberId: pierre.id, presenceConfirmedBy: pierre.id, confirmedAt: '2020-01-01T00:00:00Z' },
    });

    expect(response.statusCode).toBe(200);
    expect(julie.presenceConfirmedBy).toBe(sophie.id);
    expect(julie.proofs.presenceConfirmedAt?.getUTCFullYear()).not.toBe(2020);
  });
});
