import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { DashboardErrorBody, DashboardSpotsToCheck } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../src/seed/fixtures/parkingTestPaliers.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotSpotRepository, FakeSpot } from './fakes/fakeLotSpotRepository.ts';

// Adversarial regression guard for story #73 — the properties proven live against the running API (see
// .claude/work/73-flagged-spots/pentest.log). Attack surface: GET /v1/dashboard/lots/:id/spots-to-check and
// POST /v1/dashboard/lots/:id/spots/:spotId/check-cleared. These attacks must all stay refused.
const SINCE = '2026-11-13T15:20:00.000Z';
const UNKNOWN_SPOT = '00000000-0000-4000-8000-000000000999';
const SPOT_TO_CHECK_KEYS = ['aisleCode', 'clearable', 'heldBySession', 'levelCode', 'number', 'reason', 'since', 'spotId', 'state'];

describe('story #73 attack surface: spots to check and clearing them', () => {
  let server: FastifyInstance;
  let spots: FakeLotSpotRepository;
  let sophieCookies: Record<string, string>;

  beforeEach(async () => {
    ({ server, lotSpots: spots } = startDashboardServer());
    sophieCookies = await dashboardCookieFor(server, sophie);
  });

  afterEach(() => server.close());

  function demoSpot(number: string): FakeSpot {
    const found = spots.spots.find((spot) => spot.lotId === PARKING_DEMO_ID && spot.number === number);
    if (found === undefined) {
      throw new Error(`Parking Démo has no spot ${number}`);
    }
    return found;
  }

  function flag(number: string, state: FakeSpot['state']): FakeSpot {
    return Object.assign(demoSpot(number), { state, check: { since: SINCE, reason: 'REPORTED_TAKEN' } });
  }

  const list = (cookies: Record<string, string>, lotId = PARKING_DEMO_ID) =>
    server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/spots-to-check`, cookies });
  const clear = (cookies: Record<string, string>, spotId: string, lotId = PARKING_DEMO_ID) =>
    server.inject({ method: 'POST', url: `/v1/dashboard/lots/${lotId}/spots/${spotId}/check-cleared`, cookies, headers: writeHeader });

  // IDOR: a spot is scoped to the lot in the URL, so the operator's OTHER lot cannot reach a Parking Démo spot.
  // The 404 for a spot that exists elsewhere is identical to the 404 for one that does not: no existence oracle.
  it('gives the same SPOT_NOT_FOUND for a real spot reached through the wrong lot as for an unknown one, and clears nothing', async () => {
    const real = flag('B-2', 'AVAILABLE');

    const throughWrongLot = await clear(sophieCookies, real.id, PARKING_TEST_PALIERS_ID);
    const unknown = await clear(sophieCookies, UNKNOWN_SPOT, PARKING_TEST_PALIERS_ID);

    const shapeOf = (answer: { statusCode: number; json: () => DashboardErrorBody }) => [answer.statusCode, answer.json().error];
    expect(shapeOf(throughWrongLot)).toEqual([404, 'SPOT_NOT_FOUND']);
    expect(shapeOf(unknown)).toEqual(shapeOf(throughWrongLot));
    expect(real.check).not.toBeNull();
  });

  // The 409 SPOT_STILL_ASSIGNED answer tells the owner their flagged spot is still held; it must never leak to a non-owner,
  // who gets the lot's 404 whatever the spot's real state is.
  it('answers a non-owner 404 LOT_NOT_FOUND (never 409) for a flagged spot that is still held, and leaves it flagged', async () => {
    const held = flag('B-2', 'OCCUPIED_UNKNOWN');
    const pierreCookies = await dashboardCookieFor(server, pierre);

    const answers = [await list(pierreCookies), await clear(pierreCookies, held.id)];

    expect(answers.map((answer) => [answer.statusCode, answer.json<DashboardErrorBody>().error])).toEqual([
      [404, 'LOT_NOT_FOUND'],
      [404, 'LOT_NOT_FOUND'],
    ]);
    expect(held.check).not.toBeNull();
  });

  // Over-fetch guard: the list must carry spot facts only — no driver identity, session id, plate or payment field.
  it('exposes only the spot columns, never a driver or session field', async () => {
    flag('A-1', 'AVAILABLE');

    const { spots: rows } = (await list(sophieCookies)).json<DashboardSpotsToCheck>();

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(SPOT_TO_CHECK_KEYS);
    }
  });

  // Mass assignment: the clear has no body schema. A smuggled body must not override the real state that the guard reads.
  it('ignores a request body that tries to pass a held spot off as clearable, and refuses it all the same', async () => {
    const held = flag('B-2', 'OCCUPIED_UNKNOWN');

    const response = await server.inject({
      method: 'POST',
      url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/spots/${held.id}/check-cleared`,
      cookies: sophieCookies,
      headers: writeHeader,
      payload: { state: 'AVAILABLE', needs_check: false, isHeldBySession: false, lotId: PARKING_TEST_PALIERS_ID, operatorId: 'x' },
    });

    expect([response.statusCode, response.json<DashboardErrorBody>().error]).toEqual([409, 'SPOT_STILL_ASSIGNED']);
    expect(held.check).not.toBeNull();
  });

  // The dashboard authenticates by its own cookie only: an app driver bearer token opens neither route.
  it('refuses a driver bearer token with no dashboard cookie on both routes', async () => {
    const bearer = { authorization: `Bearer ${sophie.id}` };

    const answers = [
      await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/spots-to-check`, headers: bearer }),
      await server.inject({ method: 'POST', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/spots/${UNKNOWN_SPOT}/check-cleared`, headers: { ...bearer, ...writeHeader } }),
    ];

    expect(answers.map((answer) => answer.statusCode)).toEqual([401, 401]);
  });
});
