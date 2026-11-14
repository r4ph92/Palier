import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardAisleSpots, DashboardLotMap } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { SpotState } from '../../src/domain/spots/spotStates.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotSpotRepository } from './fakes/fakeLotSpotRepository.ts';
import { aisleA, levelIdOf, lotMapRoutesOf, type Cookies } from './fakes/lotMapRoutes.ts';
import { aisleIdOf, lotSpotRoutesOf, spotsOf, standard, type LotSpotRoutes } from './fakes/lotSpotRoutes.ts';

interface GarageRoyAisles {
  readonly cookies: Cookies;
  readonly aisleA: string;
  readonly aisleB: string;
  readonly exitLane: string;
}

describe('dashboard spot routes', () => {
  let server: FastifyInstance;
  let spots: FakeLotSpotRepository;
  let routes: LotSpotRoutes;

  afterEach(() => server.close());

  // Garage Roy with level P1, its exit lane and aisles A and B.
  async function garageRoyWithAislesAAndB(): Promise<GarageRoyAisles> {
    ({ server, lotSpots: spots } = startDashboardServer());
    routes = lotSpotRoutesOf(server);
    const mapRoutes = lotMapRoutesOf(server);
    const cookies = await dashboardCookieFor(server, pierre);
    const levelId = levelIdOf((await mapRoutes.addLevel(cookies, 'P1')).json<DashboardLotMap>(), 'P1');
    await mapRoutes.addAisle(cookies, levelId, aisleA);
    const map = (await mapRoutes.addAisle(cookies, levelId, { ...aisleA, code: 'B', beaconMinor: 2 })).json<DashboardLotMap>();
    return { cookies, aisleA: aisleIdOf(map, 'A'), aisleB: aisleIdOf(map, 'B'), exitLane: aisleIdOf(map, 'Sortie') };
  }

  async function withAisleAFilled(): Promise<GarageRoyAisles & { readonly spotIdOf: (number: string) => string }> {
    const garage = await garageRoyWithAislesAAndB();
    const added = (await routes.addSpots(garage.cookies, garage.aisleA, spotsOf('A-', '1', '20'))).json<DashboardAisleSpots>();
    return { ...garage, spotIdOf: (number) => added.spots.find((spot) => spot.number === number)?.id ?? '' };
  }

  function setState(spotId: string, state: SpotState): void {
    const spot = spots.spots.find(({ id }) => id === spotId);
    if (spot !== undefined) {
      spot.state = state;
    }
  }

  describe('adding a range', () => {
    it('adds A-1 to A-20 to aisle A in one action, in natural order, and counts them against the lot', async () => {
      const { cookies, aisleA: aisleId } = await garageRoyWithAislesAAndB();

      const added = await routes.addSpots(cookies, aisleId, spotsOf('A-', '1', '20'));

      expect(added.statusCode).toBe(201);
      const body = added.json<DashboardAisleSpots>();
      expect(body.spots.map(({ number }) => number)).toEqual(Array.from({ length: 20 }, (_, index) => `A-${index + 1}`));
      expect(body).toMatchObject({ aisleId, spotCount: 20, capacity: 0 });
      expect(body.spots[0]).toMatchObject({ state: 'AVAILABLE', isEv: false, isAccessible: false, isOversize: false, distanceToExit: 30 });
      expect((await routes.readSpots(cookies, aisleId)).json<DashboardAisleSpots>().spots).toHaveLength(20);
    });

    it('refuses A-3 again in aisle B, naming the taken number, and saves none of the range', async () => {
      const { cookies, aisleB } = await withAisleAFilled();

      for (const [prefix, first, last] of [['A-', '3', '3'], ['a ', '1', '5']] as const) {
        const refused = await routes.addSpots(cookies, aisleB, spotsOf(prefix, first, last));
        expect(refused.statusCode).toBe(409);
        expect(refused.json()).toMatchObject({ error: 'SPOT_NUMBER_TAKEN', values: { number: first === '3' ? 'A-3' : 'A-1' } });
      }
      expect((await routes.readSpots(cookies, aisleB)).json<DashboardAisleSpots>()).toMatchObject({ spots: [], spotCount: 20 });
    });

    it.each([
      ['a range of 201 spots', spotsOf('A-', '1', '201')],
      ['different prefixes, sent by hand', spotsOf('A-', '1', 'B-20')],
      ['a range that runs backwards', spotsOf('A-', '20', '1')],
    ])('refuses %s as SPOT_RANGE_INVALID', async (_case, request) => {
      const { cookies, aisleA: aisleId } = await garageRoyWithAislesAAndB();

      const refused = await routes.addSpots(cookies, aisleId, request);

      expect(refused.statusCode).toBe(400);
      expect(refused.json()).toMatchObject({ error: 'SPOT_RANGE_INVALID' });
      expect(spots.spots.filter((spot) => spot.lotId === GARAGE_ROY_ID)).toEqual([]);
    });

    it('refuses the exit lane as an aisle that does not exist', async () => {
      const { cookies, exitLane } = await garageRoyWithAislesAAndB();

      const refused = await routes.addSpots(cookies, exitLane, spotsOf('S-', '1', '2'));

      expect(refused.statusCode).toBe(404);
      expect(refused.json()).toMatchObject({ error: 'AISLE_NOT_FOUND' });
      expect((await routes.readSpots(cookies, exitLane)).statusCode).toBe(404);
    });

    it('answers LOT_BUSY with Retry-After while another write holds the lot', async () => {
      const { cookies, aisleA: aisleId } = await garageRoyWithAislesAAndB();
      spots.busyLots.add(GARAGE_ROY_ID);

      const busy = await routes.addSpots(cookies, aisleId, spotsOf('A-', '1', '20'));

      expect(busy.statusCode).toBe(503);
      expect(busy.headers['retry-after']).toBe('3');
    });
  });

  describe('the attributes of a spot', () => {
    it('ticks electric, accessible and oversize and sets the distance, and the list shows them', async () => {
      const { cookies, aisleA: aisleId, spotIdOf } = await withAisleAFilled();
      const attributes = { isEv: true, isAccessible: true, isOversize: true, distanceToExit: 12 };

      const changed = await routes.changeSpot(cookies, spotIdOf('A-3'), attributes);

      expect(changed.statusCode).toBe(200);
      expect(changed.json<DashboardAisleSpots>().spots.find(({ number }) => number === 'A-3')).toMatchObject(attributes);
      expect((await routes.readSpots(cookies, aisleId)).json<DashboardAisleSpots>().spots[2]).toMatchObject({ number: 'A-3', ...attributes });
    });

    it('changes the attributes of a spot in use, which allocation reads only when it claims a spot', async () => {
      const { cookies, spotIdOf } = await withAisleAFilled();
      setState(spotIdOf('A-3'), 'OCCUPIED');

      expect((await routes.changeSpot(cookies, spotIdOf('A-3'), { ...standard, isEv: true })).statusCode).toBe(200);
    });

    it.each([1.5, -1, 2001])('refuses %d m from the exit and keeps the spot as it was', async (distanceToExit) => {
      const { cookies, spotIdOf } = await withAisleAFilled();

      const refused = await routes.changeSpot(cookies, spotIdOf('A-3'), { ...standard, distanceToExit });

      expect(refused.statusCode).toBe(400);
      expect(refused.json()).toMatchObject({ error: 'SPOT_DISTANCE_INVALID' });
      expect(spots.spots.find(({ id }) => id === spotIdOf('A-3'))?.distanceToExit).toBe(30);
    });
  });

  describe('deleting a spot', () => {
    it.each<SpotState>(['HELD', 'ASSIGNED', 'OCCUPIED', 'OCCUPIED_UNKNOWN'])('refuses a spot %s as in use, and keeps it', async (state) => {
      const { cookies, aisleA: aisleId, spotIdOf } = await withAisleAFilled();
      setState(spotIdOf('A-3'), state);

      const refused = await routes.retireSpot(cookies, spotIdOf('A-3'));

      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ error: 'SPOT_IN_USE' });
      expect((await routes.readSpots(cookies, aisleId)).json<DashboardAisleSpots>().spots).toHaveLength(20);
    });

    it('refuses a free spot an active session still points at', async () => {
      const { cookies, spotIdOf } = await withAisleAFilled();
      const spot = spots.spots.find(({ id }) => id === spotIdOf('A-3'));
      Object.assign(spot ?? {}, { isHeldBySession: true });

      expect((await routes.retireSpot(cookies, spotIdOf('A-3'))).json()).toMatchObject({ error: 'SPOT_IN_USE' });
    });

    it('removes a free spot from the list and from the lot’s count', async () => {
      const { cookies, spotIdOf } = await withAisleAFilled();

      const deleted = await routes.retireSpot(cookies, spotIdOf('A-3'));

      expect(deleted.statusCode).toBe(200);
      const body = deleted.json<DashboardAisleSpots>();
      expect(body.spots.map(({ number }) => number)).not.toContain('A-3');
      expect(body.spotCount).toBe(19);
    });

    it('retires a spot with history: it is gone from the list, cannot be changed again, and its number is free', async () => {
      const { cookies, aisleB, spotIdOf } = await withAisleAFilled();
      Object.assign(spots.spots.find(({ id }) => id === spotIdOf('A-3')) ?? {}, { hasHistory: true });

      expect((await routes.retireSpot(cookies, spotIdOf('A-3'))).statusCode).toBe(200);

      expect(spots.spots.find(({ id }) => id === spotIdOf('A-3'))).toMatchObject({ retired: true, state: 'OUT_OF_SERVICE' });
      expect((await routes.retireSpot(cookies, spotIdOf('A-3'))).json()).toMatchObject({ error: 'SPOT_NOT_FOUND' });
      expect((await routes.changeSpot(cookies, spotIdOf('A-3'), standard)).statusCode).toBe(404);
      expect((await routes.addSpots(cookies, aisleB, spotsOf('A-', '3', '3'))).statusCode).toBe(201);
    });
  });
});
