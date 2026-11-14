// Pentest proof for story #65 (not committed). Attacks the four lot-map routes from an
// adversary's seat: cross-operator IDOR, the 404-vs-409 existence oracle, a foreign level id
// under your own lot, CSRF, missing auth, mass assignment of privileged fields, and beacon-minor
// range juggling. Everything here must stay refused or have no privileged effect.
import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardLotMap } from '@palier/shared-types';
import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, DASHBOARD_COOKIE } from './fakes/dashboardServer.ts';
import type { FakeLotMapRepository } from './fakes/fakeLotMapRepository.ts';
import { aisleA, levelIdOf, lotMapRoutesOf, type Cookies, type LotMapRoutes } from './fakes/lotMapRoutes.ts';

describe('lot map routes under attack (pentest #65)', () => {
  let server: FastifyInstance;
  let maps: FakeLotMapRepository;
  let routes: LotMapRoutes;

  afterEach(() => server.close());

  async function signIn(user: typeof pierre): Promise<Cookies> {
    ({ server, lotMaps: maps } = startDashboardServer());
    routes = lotMapRoutesOf(server);
    return dashboardCookieFor(server, user);
  }

  function parkingDemoP1(): string {
    return maps.levels.find(({ lotId }) => lotId === PARKING_DEMO_ID)?.id ?? '';
  }

  // Garage Roy belongs to Pierre (Roy). Sophie (Lavoie) must learn nothing about it, read or write.
  describe('cross-operator IDOR -> uniform 404 LOT_NOT_FOUND', () => {
    it('refuses Sophie the map, a level, a reorder and an aisle on Pierre’s lot, all with the same code', async () => {
      const cookies = await signIn(sophie);

      const read = await routes.readMap(cookies, GARAGE_ROY_ID);
      const level = await routes.addLevel(cookies, 'HACK');
      const reorder = await routes.reorder(cookies, [parkingDemoP1()]);
      const aisle = await routes.addAisle(cookies, parkingDemoP1());

      for (const response of [read, level, reorder, aisle]) {
        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
      }
    });

    // The existence oracle: a non-owner sending an aisle that would collide must still see 404,
    // never AISLE_CODE_TAKEN / AISLE_MINOR_TAKEN, so a 409 never confirms a code or minor exists.
    it('answers 404, not 409, when Sophie sends an aisle whose code/minor are taken in Pierre’s lot', async () => {
      const cookies = await signIn(sophie);

      const collide = await routes.addAisle(cookies, parkingDemoP1(), { code: 'A', beaconMinor: 1, rectangle: aisleA.rectangle });

      expect(collide.statusCode).toBe(404);
      expect(collide.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    });
  });

  // A level id the operator owns but that lives in another lot must not become a write target.
  it('refuses a foreign level id placed under the attacker’s own lot (LEVEL_NOT_FOUND)', async () => {
    const cookies = await signIn(pierre);
    await routes.addLevel(cookies, 'P1'); // Garage Roy now has a level, but not Parking Démo's P1

    const stolen = await routes.addAisle(cookies, parkingDemoP1());

    expect(stolen.statusCode).toBe(404);
    expect(stolen.json()).toMatchObject({ error: 'LEVEL_NOT_FOUND' });
  });

  describe('CSRF and authentication', () => {
    it('refuses a state change that carries the session cookie but not the write header (403)', async () => {
      const cookies = await signIn(pierre);

      const forged = await server.inject({ method: 'POST', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels`, cookies, payload: { code: 'P1' } });

      expect(forged.statusCode).toBe(403);
      expect(forged.json()).toMatchObject({ error: 'CSRF_HEADER_MISSING' });
    });

    it('refuses every route without a session cookie (401), even with the write header', async () => {
      ({ server, lotMaps: maps } = startDashboardServer());
      const headers = { [DASHBOARD_CSRF_HEADER]: DASHBOARD_CSRF_VALUE };

      const read = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/map`, headers });
      const write = await server.inject({ method: 'POST', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels`, headers, payload: { code: 'P1' } });

      for (const response of [read, write]) {
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ error: 'UNAUTHORIZED' });
      }
    });

    it('rejects a forged session token (401)', async () => {
      ({ server, lotMaps: maps } = startDashboardServer());

      const response = await server.inject({
        method: 'GET',
        url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/map`,
        cookies: { [DASHBOARD_COOKIE]: 'forged-token-not-in-store' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // Fastify strips unknown body properties (ajv removeAdditional); the write path never reads them,
  // so isExitLane / lotId / id supplied by the client have no privileged effect.
  it('ignores privileged fields smuggled into the aisle body (no exit-lane takeover, no lot hijack)', async () => {
    const cookies = await signIn(pierre);
    const withP1 = (await routes.addLevel(cookies, 'P1')).json<DashboardLotMap>();

    const response = await routes.addAisle(cookies, levelIdOf(withP1, 'P1'), {
      code: 'A',
      beaconMinor: 1,
      rectangle: aisleA.rectangle,
      isExitLane: true,
      lotId: PARKING_DEMO_ID,
      id: '00000000-0000-4000-8000-0000000000ff',
    });

    expect(response.statusCode).toBe(200);
    const added = response.json<DashboardLotMap>().levels[0]?.aisles.find((aisle) => aisle.code === 'A');
    expect(added?.isExitLane).toBe(false); // the smuggled exit-lane flag was dropped
    expect(added?.id).not.toBe('00000000-0000-4000-8000-0000000000ff'); // id is server-assigned
  });

  // A normal aisle may never claim minor 0 (the exit lane's) or anything outside 1..65535.
  it.each([
    ['0 (the exit lane minor)', 0],
    ['65536 (past 16 bits)', 65536],
    ['-1', -1],
    ['1.5 (not whole)', 1.5],
  ])('refuses beacon minor %s with AISLE_MINOR_INVALID, nothing saved', async (_case, beaconMinor) => {
    const cookies = await signIn(pierre);
    const withP1 = (await routes.addLevel(cookies, 'P1')).json<DashboardLotMap>();

    const response = await routes.addAisle(cookies, levelIdOf(withP1, 'P1'), { code: 'Z', beaconMinor, rectangle: aisleA.rectangle });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'AISLE_MINOR_INVALID' });
  });
});
