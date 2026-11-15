import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardAisleSpots } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotSpotRepository, FakeSpot } from './fakes/fakeLotSpotRepository.ts';
import { lotSpotRoutesOf, type LotSpotRoutes } from './fakes/lotSpotRoutes.ts';
import type { SpotState } from '../../src/domain/spots/spotStates.ts';

describe('taking a spot out of service and back', () => {
  let server: FastifyInstance;
  let spots: FakeLotSpotRepository;
  let routes: LotSpotRoutes;

  afterEach(() => server.close());

  async function parkingDemoSpotA3() {
    ({ server, lotSpots: spots } = startDashboardServer());
    routes = lotSpotRoutesOf(server, PARKING_DEMO_ID);
    const spot = spots.spots.find(({ lotId, number }) => lotId === PARKING_DEMO_ID && number === 'A-3') as FakeSpot;
    return { spot, cookies: await dashboardCookieFor(server, sophie), before: structuredClone(spots.spots) };
  }

  it('shows A-3 out of service in the answer, and keeps it out of the free spots', async () => {
    const { spot, cookies } = await parkingDemoSpotA3();

    const answer = await routes.setService(cookies, spot.id, true);

    expect(answer.statusCode).toBe(200);
    expect(answer.json<DashboardAisleSpots>().spots.find(({ id }) => id === spot.id)?.state).toBe('OUT_OF_SERVICE');
    expect(spot.state).toBe('OUT_OF_SERVICE');
  });

  it('puts A-3 back as free', async () => {
    const { spot, cookies } = await parkingDemoSpotA3();
    spot.state = 'OUT_OF_SERVICE';

    const answer = await routes.setService(cookies, spot.id, false);

    expect(answer.statusCode).toBe(200);
    expect(answer.json<DashboardAisleSpots>().spots.find(({ id }) => id === spot.id)?.state).toBe('AVAILABLE');
  });

  it('answers success when the spot is already in the wanted state', async () => {
    const { spot, cookies } = await parkingDemoSpotA3();

    expect((await routes.setService(cookies, spot.id, false)).statusCode).toBe(200);
    await routes.setService(cookies, spot.id, true);
    expect((await routes.setService(cookies, spot.id, true)).statusCode).toBe(200);
  });

  it.each<SpotState>(['HELD', 'ASSIGNED', 'OCCUPIED', 'OCCUPIED_UNKNOWN'])('refuses a spot %s as in use and changes nothing', async (state) => {
    const { spot, cookies, before } = await parkingDemoSpotA3();
    spot.state = state;
    before.find(({ id }) => id === spot.id)!.state = state;

    const refused = await routes.setService(cookies, spot.id, true);

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ error: 'SPOT_IN_USE' });
    expect(spots.spots).toEqual(before);
  });

  it('refuses a free spot an active session still points at', async () => {
    const { spot, cookies, before } = await parkingDemoSpotA3();
    spot.isHeldBySession = true;
    before.find(({ id }) => id === spot.id)!.isHeldBySession = true;

    expect((await routes.setService(cookies, spot.id, true)).statusCode).toBe(409);
    expect(spots.spots).toEqual(before);
  });

  it('never revives a retired spot', async () => {
    const { spot, cookies } = await parkingDemoSpotA3();
    Object.assign(spot, { retired: true, state: 'OUT_OF_SERVICE' });

    const answer = await routes.setService(cookies, spot.id, false);

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'SPOT_NOT_FOUND' });
    expect(spot.state).toBe('OUT_OF_SERVICE');
  });

  it('answers Pierre Roy not found on Parking Démo’s spot and changes nothing', async () => {
    const { spot, before } = await parkingDemoSpotA3();

    const answer = await routes.setService(await dashboardCookieFor(server, pierre), spot.id, true);

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    expect(spots.spots).toEqual(before);
  });

  it('refuses a body that is not exactly outOfService as a boolean', async () => {
    const { spot, cookies } = await parkingDemoSpotA3();

    const answer = await server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/spots/${spot.id}/service`, cookies, headers: writeHeader, payload: { outOfService: 'yes', state: 'ASSIGNED' } });

    expect(answer.statusCode).toBeGreaterThanOrEqual(400);
    expect(spot.state).toBe('AVAILABLE');
  });
});
