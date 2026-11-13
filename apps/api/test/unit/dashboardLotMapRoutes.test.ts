import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardLotMap } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotMapRepository } from './fakes/fakeLotMapRepository.ts';
import { aisleA, levelIdOf, lotMapRoutesOf, type Cookies, type LotMapRoutes } from './fakes/lotMapRoutes.ts';

const PLATFORM_UUID = '7B8098B8-9525-4406-AB73-4ABD2095EDC3';

describe('dashboard lot map routes', () => {
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

  describe('levels', () => {
    it('shows P1 then P2 in the order Pierre added them, then swaps them', async () => {
      const { cookies, map } = await garageRoyWithP1AndP2();

      expect(map.levels.map(({ code, displayOrder }) => [code, displayOrder])).toEqual([['P1', 1], ['P2', 2]]);

      const swapped = await routes.reorder(cookies, [levelIdOf(map, 'P2'), levelIdOf(map, 'P1')]);

      expect(swapped.statusCode).toBe(200);
      expect(swapped.json<DashboardLotMap>().levels.map(({ code, displayOrder }) => [code, displayOrder])).toEqual([['P2', 1], ['P1', 2]]);
    });

    it('trims the code, and refuses a code the lot already has', async () => {
      const cookies = await signIn(pierre);

      const added = await routes.addLevel(cookies, '  P1 ');
      const again = await routes.addLevel(cookies, 'P1');

      expect(added.json<DashboardLotMap>().levels.map(({ code }) => code)).toEqual(['P1']);
      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({ error: 'LEVEL_CODE_TAKEN' });
    });

    it('refuses an empty code and a 21st level, even one with a taken code, as the SQL does', async () => {
      const cookies = await signIn(pierre);
      for (let level = 1; level <= 20; level += 1) {
        await routes.addLevel(cookies, `P${level}`);
      }

      expect((await routes.addLevel(cookies, '   ')).json()).toMatchObject({ statusCode: 400, error: 'LEVEL_CODE_INVALID' });
      expect((await routes.addLevel(cookies, 'P21')).json()).toMatchObject({ statusCode: 409, error: 'LEVEL_LIMIT_REACHED' });
      expect((await routes.addLevel(cookies, 'P1')).json()).toMatchObject({ statusCode: 409, error: 'LEVEL_LIMIT_REACHED' });
    });

    it('refuses an order that leaves out a level or names another lot’s, and keeps the order', async () => {
      const { cookies, map } = await garageRoyWithP1AndP2();

      const missing = await routes.reorder(cookies, [levelIdOf(map, 'P2')]);
      const foreign = await routes.reorder(cookies, [levelIdOf(map, 'P2'), parkingDemoP1()]);

      for (const response of [missing, foreign]) {
        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject({ error: 'LEVEL_ORDER_INVALID' });
      }
      expect((await routes.readMap(cookies)).json<DashboardLotMap>().levels.map(({ code }) => code)).toEqual(['P1', 'P2']);
    });

    it('refuses a move made from the order another tab changed since, even one a step from the saved order', async () => {
      const cookies = await signIn(pierre);
      await routes.addLevel(cookies, 'P1');
      await routes.addLevel(cookies, 'P2');
      const map = (await routes.addLevel(cookies, 'P3')).json<DashboardLotMap>();
      const [p1, p2, p3] = [levelIdOf(map, 'P1'), levelIdOf(map, 'P2'), levelIdOf(map, 'P3')];
      await routes.reorder(cookies, [p2, p1, p3], [p1, p2, p3]);
      await routes.reorder(cookies, [p2, p3, p1], [p2, p1, p3]);

      const stale = await routes.reorder(cookies, [p2, p1, p3], [p1, p2, p3]);

      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ error: 'LEVEL_ORDER_INVALID' });
      expect((await routes.readMap(cookies)).json<DashboardLotMap>().levels.map(({ code }) => code)).toEqual(['P2', 'P3', 'P1']);
    });

    it.each([
      ['an empty list', []],
      ['an id that is not a uuid', ['P1']],
      ['the same id twice', [PARKING_DEMO_ID, PARKING_DEMO_ID]],
    ])('answers 400 to %s', async (_case, levelIds) => {
      const cookies = await signIn(pierre);

      expect((await routes.reorder(cookies, levelIds)).statusCode).toBe(400);
    });
  });

  describe('aisles', () => {
    it('gives Garage Roy its exit lane, minor 0, with its first level, and adds aisle A with minor 1 and its rectangle', async () => {
      const cookies = await signIn(pierre);
      const withP1 = (await routes.addLevel(cookies, 'P1')).json<DashboardLotMap>();

      const response = await routes.addAisle(cookies, levelIdOf(withP1, 'P1'));

      expect(response.statusCode).toBe(200);
      expect(response.json<DashboardLotMap>().levels[0]?.aisles).toEqual([
        { id: expect.any(String), ...aisleA, isExitLane: false },
        { id: expect.any(String), code: 'Sortie', beaconMinor: 0, isExitLane: true, rectangle: null },
      ]);
    });

    it('adds no second exit lane with the second level', async () => {
      const { map } = await garageRoyWithP1AndP2();

      expect(map.levels.map(({ aisles }) => aisles.filter(({ isExitLane }) => isExitLane).length)).toEqual([1, 0]);
    });

    it.each([
      ['minor 0', { ...aisleA, beaconMinor: 0 }, 'AISLE_MINOR_INVALID'],
      ['minor 65 536', { ...aisleA, beaconMinor: 65_536 }, 'AISLE_MINOR_INVALID'],
      ['a fractional minor', { ...aisleA, beaconMinor: 1.5 }, 'AISLE_MINOR_INVALID'],
      ['no rectangle', { code: 'A', beaconMinor: 1 }, 'AISLE_RECTANGLE_INVALID'],
      ['a null rectangle', { ...aisleA, rectangle: null }, 'AISLE_RECTANGLE_INVALID'],
      ['a rectangle with no width', { ...aisleA, rectangle: { ...aisleA.rectangle, width: 0 } }, 'AISLE_RECTANGLE_INVALID'],
      ['an empty code', { ...aisleA, code: ' ' }, 'AISLE_CODE_INVALID'],
    ])('refuses %s with 400 and saves nothing', async (_case, payload, error) => {
      const { cookies, map } = await garageRoyWithP1AndP2();

      const response = await routes.addAisle(cookies, levelIdOf(map, 'P1'), payload);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error });
      expect((await routes.readMap(cookies)).json()).toEqual(map);
    });

    it('refuses a minor another aisle of the lot uses, on another level too, and saves nothing', async () => {
      const { cookies, map } = await garageRoyWithP1AndP2();
      const withA = (await routes.addAisle(cookies, levelIdOf(map, 'P1'))).json<DashboardLotMap>();

      const response = await routes.addAisle(cookies, levelIdOf(map, 'P2'), { ...aisleA, code: 'B' });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'AISLE_MINOR_TAKEN' });
      expect((await routes.readMap(cookies)).json()).toEqual(withA);
    });

    it('refuses a code the level already has', async () => {
      const { cookies, map } = await garageRoyWithP1AndP2();
      await routes.addAisle(cookies, levelIdOf(map, 'P1'));

      const response = await routes.addAisle(cookies, levelIdOf(map, 'P1'), { ...aisleA, beaconMinor: 2 });

      expect(response.json()).toMatchObject({ statusCode: 409, error: 'AISLE_CODE_TAKEN' });
    });

    it('refuses the exit lane’s code on its level as reserved, and accepts it on another level', async () => {
      const { cookies, map } = await garageRoyWithP1AndP2();

      const onExitLaneLevel = await routes.addAisle(cookies, levelIdOf(map, 'P1'), { ...aisleA, code: 'Sortie' });
      const onOtherLevel = await routes.addAisle(cookies, levelIdOf(map, 'P2'), { ...aisleA, code: 'Sortie' });

      expect(onExitLaneLevel.json()).toEqual({ statusCode: 409, error: 'AISLE_CODE_RESERVED', message: "Sortie is the code of this level's exit lane; choose another code." });
      expect(onOtherLevel.statusCode).toBe(200);
    });
  });

  describe('beacons', () => {
    it('gives the platform UUID, the lot major and every minor, ready to program', async () => {
      const cookies = await signIn(sophie);

      const map = (await routes.readMap(cookies, PARKING_DEMO_ID)).json<DashboardLotMap>();

      expect(map).toMatchObject({ lotId: PARKING_DEMO_ID, lotName: 'Parking Démo', platformUuid: PLATFORM_UUID, beaconMajor: 1 });
      expect(map.levels.flatMap(({ aisles }) => aisles.map(({ code, beaconMinor }) => [code, beaconMinor]))).toEqual([['A', 1], ['B', 2], ['Sortie', 0]]);
    });
  });

  it('answers a busy lot with 503 and Retry-After', async () => {
    const cookies = await signIn(pierre);
    maps.busyLots.add(GARAGE_ROY_ID);

    const response = await routes.addLevel(cookies, 'P1');

    expect(response.statusCode).toBe(503);
    expect(response.headers['retry-after']).toBe('3');
    expect(response.json()).toMatchObject({ error: 'LOT_BUSY' });
  });

  it('refuses a visitor with no session, and a write without the dashboard header', async () => {
    const cookies = await signIn(pierre);

    expect((await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/map` })).statusCode).toBe(401);
    expect((await server.inject({ method: 'POST', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels`, cookies, payload: { code: 'P1' } })).statusCode).toBe(403);
  });
});
