import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import type { SpotState } from '../../src/domain/spots/spotStates.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotSpotRepository, FakeSpot } from './fakes/fakeLotSpotRepository.ts';
import { lotSpotRoutesOf } from './fakes/lotSpotRoutes.ts';

describe('taking a spot out of service under attack (QA #69)', () => {
  let server: FastifyInstance;
  let spots: FakeLotSpotRepository;

  afterEach(() => server.close());

  function parkingDemoSpot(number: string): FakeSpot {
    ({ server, lotSpots: spots } = startDashboardServer());
    return spots.spots.find(({ lotId, number: candidate }) => lotId === PARKING_DEMO_ID && candidate === number) as FakeSpot;
  }

  function servicePathOf(lotId: string, spotId: string): string {
    return `/v1/dashboard/lots/${lotId}/spots/${spotId}/service`;
  }

  it('answers Pierre Roy not found when he names Parking Démo’s spot under his own lot, and changes nothing', async () => {
    const spot = parkingDemoSpot('A-3');
    const before = structuredClone(spots.spots);

    const answer = await lotSpotRoutesOf(server, GARAGE_ROY_ID).setService(await dashboardCookieFor(server, pierre), spot.id, true);

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'SPOT_NOT_FOUND' });
    expect(spots.spots).toEqual(before);
  });

  it.each<SpotState>(['HELD', 'ASSIGNED', 'OCCUPIED', 'OCCUPIED_UNKNOWN'])('refuses putting back a spot %s as in use and changes nothing', async (state) => {
    const spot = parkingDemoSpot('A-1');
    spot.state = state;
    const before = structuredClone(spots.spots);

    const refused = await lotSpotRoutesOf(server, PARKING_DEMO_ID).setService(await dashboardCookieFor(server, sophie), spot.id, false);

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ error: 'SPOT_IN_USE' });
    expect(spots.spots).toEqual(before);
  });

  it('answers a malformed spot id with the lot’s not found and changes nothing', async () => {
    parkingDemoSpot('A-3');
    const before = structuredClone(spots.spots);
    const cookies = await dashboardCookieFor(server, sophie);

    const answer = await server.inject({ method: 'PUT', url: servicePathOf(PARKING_DEMO_ID, "1' or 1=1--"), cookies, headers: writeHeader, payload: { outOfService: true } });

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    expect(spots.spots).toEqual(before);
  });

  it.each([
    ['a string', { outOfService: 'true' }],
    ['a number', { outOfService: 1 }],
    ['null', { outOfService: null }],
    ['missing', {}],
  ])('refuses outOfService given as %s and changes nothing', async (_kind, payload) => {
    const spot = parkingDemoSpot('A-3');
    const cookies = await dashboardCookieFor(server, sophie);

    const answer = await server.inject({ method: 'PUT', url: servicePathOf(PARKING_DEMO_ID, spot.id), cookies, headers: writeHeader, payload });

    expect(answer.statusCode).toBe(400);
    expect(spot.state).toBe('AVAILABLE');
  });

  it('refuses a guest and a request without the dashboard header, and changes nothing', async () => {
    const spot = parkingDemoSpot('A-3');
    const cookies = await dashboardCookieFor(server, sophie);
    const url = servicePathOf(PARKING_DEMO_ID, spot.id);

    const guest = await server.inject({ method: 'PUT', url, headers: writeHeader, payload: { outOfService: true } });
    const forged = await server.inject({ method: 'PUT', url, cookies, payload: { outOfService: true } });

    expect(guest.statusCode).toBe(401);
    expect(forged.statusCode).toBe(403);
    expect(spot.state).toBe('AVAILABLE');
  });
});
