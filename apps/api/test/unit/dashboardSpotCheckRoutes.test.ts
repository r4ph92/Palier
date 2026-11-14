import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardErrorBody, DashboardSpotToCheck } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotSpotRepository, FakeSpot } from './fakes/fakeLotSpotRepository.ts';
import type { FakeSpotCheckRepository } from './fakes/fakeSpotCheckRepository.ts';

const WRONG_AISLE_AT = '2026-11-13T14:05:00.000Z';
const REPORTED_TAKEN_AT = '2026-11-13T15:20:00.000Z';
const STILL_ASSIGNED = { code: 'SPOT_STILL_ASSIGNED', message: 'Spot still assigned to a session; wait for the exit.' };

describe('the spots flagged for a physical check, and clearing them', () => {
  let server: FastifyInstance;
  let spots: FakeLotSpotRepository;
  let spotChecks: FakeSpotCheckRepository;
  let sophieCookies: Record<string, string>;

  beforeEach(async () => {
    ({ server, lotSpots: spots, spotChecks } = startDashboardServer());
    sophieCookies = await dashboardCookieFor(server, sophie);
  });

  afterEach(() => server.close());

  function spotNamed(number: string): FakeSpot {
    const found = spots.spots.find((spot) => spot.lotId === PARKING_DEMO_ID && spot.number === number);
    if (found === undefined) {
      throw new Error(`Parking Démo has no spot ${number}`);
    }
    return found;
  }

  // Julie parked in another aisle: A-1 is occupied-unknown. Marc reported B-2 taken, and it was freed later by the exit.
  function flagA1AndB2(): void {
    Object.assign(spotNamed('A-1'), { state: 'OCCUPIED_UNKNOWN', check: { since: WRONG_AISLE_AT, reason: 'WRONG_AISLE' } });
    Object.assign(spotNamed('B-2'), { state: 'AVAILABLE', check: { since: REPORTED_TAKEN_AT, reason: 'REPORTED_TAKEN' } });
  }

  const list = (cookies: Record<string, string>, lotId = PARKING_DEMO_ID) => server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/spots-to-check`, cookies });
  const clear = (cookies: Record<string, string>, spotId: string, lotId = PARKING_DEMO_ID) =>
    server.inject({ method: 'POST', url: `/v1/dashboard/lots/${lotId}/spots/${spotId}/check-cleared`, cookies, headers: writeHeader });

  it('lists A-1 and B-2 with their time and reason, oldest flag first', async () => {
    flagA1AndB2();

    const response = await list(sophieCookies);

    expect(response.statusCode).toBe(200);
    expect(response.json<DashboardSpotToCheck[]>()).toEqual([
      expect.objectContaining({ number: 'A-1', since: WRONG_AISLE_AT, reason: 'WRONG_AISLE', state: 'OCCUPIED_UNKNOWN' }),
      expect.objectContaining({ number: 'B-2', since: REPORTED_TAKEN_AT, reason: 'REPORTED_TAKEN', state: 'AVAILABLE' }),
    ]);
  });

  it('names the level and the aisle of each flagged spot', async () => {
    flagA1AndB2();

    const [first] = (await list(sophieCookies)).json<DashboardSpotToCheck[]>();

    expect(first).toEqual(expect.objectContaining({ aisleCode: 'A', levelCode: expect.any(String) }));
  });

  it('lists nothing for a lot with no flagged spot, and leaves out a retired one', async () => {
    Object.assign(spotNamed('A-1'), { retired: true, state: 'OUT_OF_SERVICE', check: { since: WRONG_AISLE_AT, reason: 'WRONG_AISLE' } });

    expect((await list(sophieCookies)).json()).toEqual([]);
  });

  it('keeps a flag raised before reasons were recorded, with no reason', async () => {
    Object.assign(spotNamed('A-1'), { check: { since: WRONG_AISLE_AT, reason: null } });

    expect((await list(sophieCookies)).json<DashboardSpotToCheck[]>()[0]?.reason).toBeNull();
  });

  it('clears the flag of a free flagged spot, answers the spots still flagged, and hands the spot out normally again', async () => {
    flagA1AndB2();

    const response = await clear(sophieCookies, spotNamed('B-2').id);

    expect(response.statusCode).toBe(200);
    expect(response.json<DashboardSpotToCheck[]>().map(({ number }) => number)).toEqual(['A-1']);
    expect(spotNamed('B-2').check).toBeNull();
  });

  it('answers a second click on a cleared spot the same way, without an error', async () => {
    flagA1AndB2();
    await clear(sophieCookies, spotNamed('B-2').id);

    const again = await clear(sophieCookies, spotNamed('B-2').id);

    expect(again.statusCode).toBe(200);
  });

  it.each([
    ['still occupied-unknown', { state: 'OCCUPIED_UNKNOWN' }],
    ['assigned', { state: 'ASSIGNED' }],
    ['held', { state: 'HELD' }],
    ['free but held by an active session', { state: 'AVAILABLE', isHeldBySession: true }],
  ] as const)('refuses a flagged spot that is %s with SPOT_STILL_ASSIGNED, and changes nothing', async (_label, held) => {
    flagA1AndB2();
    Object.assign(spotNamed('A-1'), held);
    const before = structuredClone(spots.spots);

    const response = await clear(sophieCookies, spotNamed('A-1').id);

    expect(response.statusCode).toBe(409);
    expect(response.json<DashboardErrorBody>()).toMatchObject({ error: STILL_ASSIGNED.code, message: STILL_ASSIGNED.message });
    expect(spots.spots).toEqual(before);
  });

  it('answers SPOT_NOT_FOUND for a retired spot and for an unknown one', async () => {
    Object.assign(spotNamed('A-1'), { retired: true });

    const retired = await clear(sophieCookies, spotNamed('A-1').id);
    const unknown = await clear(sophieCookies, '00000000-0000-4000-8000-000000000999');

    expect([retired.statusCode, retired.json<DashboardErrorBody>().error]).toEqual([404, 'SPOT_NOT_FOUND']);
    expect([unknown.statusCode, unknown.json<DashboardErrorBody>().error]).toEqual([404, 'SPOT_NOT_FOUND']);
  });

  it('answers LOT_BUSY with Retry-After when the lot lock is not free, and changes nothing', async () => {
    flagA1AndB2();
    spotChecks.busyLots.add(PARKING_DEMO_ID);

    const response = await clear(sophieCookies, spotNamed('B-2').id);

    expect([response.statusCode, response.json<DashboardErrorBody>().error]).toEqual([503, 'LOT_BUSY']);
    expect(response.headers['retry-after']).toBeDefined();
    expect(spotNamed('B-2').check).not.toBeNull();
  });

  describe('for an operator that does not own the lot', () => {
    it('answers Pierre Roy 404 LOT_NOT_FOUND on the list and on a clear of a Parking Démo flag, and the flag stays', async () => {
      flagA1AndB2();
      const pierreCookies = await dashboardCookieFor(server, pierre);

      const answers = [await list(pierreCookies), await clear(pierreCookies, spotNamed('B-2').id)];

      expect(answers.map((answer) => [answer.statusCode, answer.json<DashboardErrorBody>().error])).toEqual([
        [404, 'LOT_NOT_FOUND'],
        [404, 'LOT_NOT_FOUND'],
      ]);
      expect(spotNamed('B-2').check).not.toBeNull();
    });

    it('refuses a visitor with no session on both routes', async () => {
      const answers = [await list({}), await clear({}, spotNamed('B-2').id)];

      expect(answers.map((answer) => answer.statusCode)).toEqual([401, 401]);
    });

    it('answers a malformed lot or spot id with the lot 404', async () => {
      const malformedLot = await list(sophieCookies, 'not-a-uuid');
      const malformedSpot = await clear(sophieCookies, 'not-a-uuid');

      expect([malformedLot.statusCode, malformedSpot.statusCode]).toEqual([404, 404]);
    });

    it('refuses a clear with no dashboard write header', async () => {
      const response = await server.inject({ method: 'POST', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/spots/${spotNamed('B-2').id}/check-cleared`, cookies: sophieCookies });

      expect(response.statusCode).toBe(403);
    });
  });
});
