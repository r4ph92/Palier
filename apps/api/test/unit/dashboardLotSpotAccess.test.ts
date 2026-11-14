import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardAisleSpots, DashboardLotMap } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../src/seed/fixtures/parkingTestPaliers.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotSpotRepository } from './fakes/fakeLotSpotRepository.ts';
import { aisleA, levelIdOf, lotMapRoutesOf } from './fakes/lotMapRoutes.ts';
import { aisleIdOf, lotSpotRoutesOf, spotsOf, standard, type LotSpotRoutes } from './fakes/lotSpotRoutes.ts';

const MALFORMED_ID = 'not-a-uuid';

describe('who may change the spots of a lot', () => {
  let server: FastifyInstance;
  let spots: FakeLotSpotRepository;
  let routes: LotSpotRoutes;

  afterEach(() => server.close());

  // Pierre's aisle A with A-1 to A-3, and the state of every spot before Sophie tries anything.
  async function pierresAisleA() {
    ({ server, lotSpots: spots } = startDashboardServer());
    routes = lotSpotRoutesOf(server);
    const mapRoutes = lotMapRoutesOf(server);
    const cookies = await dashboardCookieFor(server, pierre);
    const levelId = levelIdOf((await mapRoutes.addLevel(cookies, 'P1')).json<DashboardLotMap>(), 'P1');
    const aisleId = aisleIdOf((await mapRoutes.addAisle(cookies, levelId, aisleA)).json<DashboardLotMap>(), 'A');
    const added = (await routes.addSpots(cookies, aisleId, spotsOf('A-', '1', '3'))).json<DashboardAisleSpots>();
    return { aisleId, spotId: added.spots[0]?.id ?? '', before: structuredClone(spots.spots), sophieCookies: await dashboardCookieFor(server, sophie) };
  }

  function parkingDemoSpotId(): string {
    return spots.spots.find(({ lotId }) => lotId === PARKING_DEMO_ID)?.id ?? '';
  }

  it('answers Sophie 404 on every spot route of Pierre’s lot, the writes refused at the lot lock, and changes nothing', async () => {
    const { aisleId, spotId, before, sophieCookies } = await pierresAisleA();

    const answers = [
      await routes.readSpots(sophieCookies, aisleId),
      await routes.addSpots(sophieCookies, aisleId, spotsOf('Z-', '1', '2')),
      await routes.changeSpot(sophieCookies, spotId, { ...standard, isEv: true }),
      await routes.removeSpot(sophieCookies, spotId),
    ];

    expect(answers.map((answer) => [answer.statusCode, answer.json().error])).toEqual([
      [404, 'AISLE_NOT_FOUND'],
      [404, 'LOT_NOT_FOUND'],
      [404, 'LOT_NOT_FOUND'],
      [404, 'LOT_NOT_FOUND'],
    ]);
    expect(spots.spots).toEqual(before);
  });

  it('answers Sophie not found when she names her own lot with Pierre’s aisle or spot, and changes nothing', async () => {
    const { aisleId, spotId, before, sophieCookies } = await pierresAisleA();

    const onParkingDemo = lotSpotRoutesOf(server, PARKING_DEMO_ID);

    const read = await onParkingDemo.readSpots(sophieCookies, aisleId);
    const added = await onParkingDemo.addSpots(sophieCookies, aisleId, spotsOf('Z-', '1', '2'));
    const changed = await onParkingDemo.changeSpot(sophieCookies, spotId, { ...standard, isEv: true });
    const retired = await onParkingDemo.removeSpot(sophieCookies, spotId);

    expect([read, added].map((answer) => [answer.statusCode, answer.json().error])).toEqual([[404, 'AISLE_NOT_FOUND'], [404, 'AISLE_NOT_FOUND']]);
    expect([changed, retired].map((answer) => [answer.statusCode, answer.json().error])).toEqual([[404, 'SPOT_NOT_FOUND'], [404, 'SPOT_NOT_FOUND']]);
    expect(spots.spots).toEqual(before);
  });

  it('answers not found for an aisle or a spot of another lot of the same operator', async () => {
    const { before, sophieCookies } = await pierresAisleA();
    const parkingDemoAisle = spots.spots.find(({ lotId }) => lotId === PARKING_DEMO_ID)?.aisleId ?? '';

    const onParkingTestPaliers = lotSpotRoutesOf(server, PARKING_TEST_PALIERS_ID);

    const added = await onParkingTestPaliers.addSpots(sophieCookies, parkingDemoAisle, spotsOf('Z-', '1', '2'));
    const retired = await onParkingTestPaliers.removeSpot(sophieCookies, parkingDemoSpotId());

    expect(added.json()).toMatchObject({ statusCode: 404, error: 'AISLE_NOT_FOUND' });
    expect(retired.json()).toMatchObject({ statusCode: 404, error: 'SPOT_NOT_FOUND' });
    expect(spots.spots).toEqual(before);
  });

  it('answers a malformed aisle or spot id with the lot’s 404, never a 400', async () => {
    const { sophieCookies } = await pierresAisleA();
    const pierreCookies = await dashboardCookieFor(server, pierre);

    expect((await routes.readSpots(pierreCookies, MALFORMED_ID)).json()).toMatchObject({ statusCode: 404, error: 'LOT_NOT_FOUND' });
    expect((await lotSpotRoutesOf(server, PARKING_DEMO_ID).removeSpot(sophieCookies, MALFORMED_ID)).json()).toMatchObject({ statusCode: 404, error: 'LOT_NOT_FOUND' });
    expect((await routes.changeSpot(pierreCookies, MALFORMED_ID, standard)).json()).toMatchObject({ statusCode: 404, error: 'LOT_NOT_FOUND' });
  });

  it('refuses a visitor without a session before reading the body', async () => {
    const { aisleId } = await pierresAisleA();

    const refused = await routes.addSpots({}, aisleId, { range: 'not even an object' });

    expect(refused.statusCode).toBe(401);
  });
});
