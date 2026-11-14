import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardLotMap } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotMapRepository } from './fakes/fakeLotMapRepository.ts';
import { aisleA, levelIdOf, lotMapRoutesOf, type Cookies, type LotMapRoutes } from './fakes/lotMapRoutes.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };

describe('dashboard lot map routes for anyone but the lot’s operator', () => {
  let server: FastifyInstance;
  let maps: FakeLotMapRepository;
  let routes: LotMapRoutes;

  afterEach(() => server.close());

  async function signIn(user: typeof pierre): Promise<Cookies> {
    ({ server, lotMaps: maps } = startDashboardServer());
    routes = lotMapRoutesOf(server);
    return dashboardCookieFor(server, user);
  }

  async function garageRoyWithP1AndP2(): Promise<{ cookies: Cookies; map: DashboardLotMap }> {
    const cookies = await signIn(pierre);
    await routes.addLevel(cookies, 'P1');
    const map = (await routes.addLevel(cookies, 'P2')).json<DashboardLotMap>();
    return { cookies, map };
  }

  function parkingDemoP1(): string {
    return maps.levels.find(({ lotId }) => lotId === PARKING_DEMO_ID)?.id ?? '';
  }

  it('answers Sophie not found on every route of Pierre’s lot, even with a taken code or minor, and changes nothing', async () => {
    const { cookies: pierreCookies, map } = await garageRoyWithP1AndP2();
    const p1 = levelIdOf(map, 'P1');
    await routes.addAisle(pierreCookies, p1);
    const before = structuredClone(maps.levels);
    const cookies = await dashboardCookieFor(server, sophie);

    const responses = [
      await routes.readMap(cookies),
      await routes.addLevel(cookies, 'P1'),
      await routes.reorder(cookies, [levelIdOf(map, 'P2'), p1]),
      await routes.addAisle(cookies, p1),
      await routes.addAisle(cookies, p1, { ...aisleA, beaconMinor: 2 }),
    ];

    for (const response of responses) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(LOT_NOT_FOUND);
    }
    expect(maps.levels).toEqual(before);
  });

  it('answers Pierre level not found when he adds an aisle under his lot to a level of Sophie’s', async () => {
    const cookies = await signIn(pierre);
    const before = structuredClone(maps.levels);

    const response = await routes.addAisle(cookies, parkingDemoP1(), { ...aisleA, beaconMinor: 9 });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'LEVEL_NOT_FOUND' });
    expect(maps.levels).toEqual(before);
  });

  it('checks the body before the lot, so a refused body says nothing about whose lot it is', async () => {
    const cookies = await signIn(sophie);

    expect((await routes.addLevel(cookies, '   ')).json()).toMatchObject({ statusCode: 400, error: 'LEVEL_CODE_INVALID' });
  });

  it('answers a member without an operator not found', async () => {
    const cookies = await signIn(nouvelOperateur);

    expect((await routes.readMap(cookies)).json()).toEqual(LOT_NOT_FOUND);
    expect((await routes.addLevel(cookies, 'P1')).json()).toEqual(LOT_NOT_FOUND);
  });

  it('answers the same 404 for a malformed lot id or level id', async () => {
    const cookies = await signIn(pierre);

    expect((await routes.readMap(cookies, 'not-a-uuid')).json()).toEqual(LOT_NOT_FOUND);
    expect((await routes.addAisle(cookies, 'not-a-uuid')).json()).toEqual(LOT_NOT_FOUND);
  });
});
