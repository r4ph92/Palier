import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { julie } from './fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };

const HOSTILE_IDS = [
  `${PARKING_DEMO_ID}%20`,
  `${PARKING_DEMO_ID}'%20or%201%3D1--`,
  '00000000000040008000000000000201',
  `%7B${PARKING_DEMO_ID}%7D`,
  '%C3%A9%F0%9F%9A%97',
  '-1',
  'x'.repeat(100),
];

describe('GET /v1/dashboard/lots/:id/occupancy under attack', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function signedIn(user: typeof sophie) {
    ({ server } = startDashboardServer());
    return dashboardCookieFor(server, user);
  }

  it.each(HOSTILE_IDS)('answers Sophie the same 404 for the hostile id %s', async (id) => {
    const cookies = await signedIn(sophie);

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${id}/occupancy`, cookies });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(LOT_NOT_FOUND);
  });

  it.each([
    ['a driver with no operator', julie],
    ['a member whose operator has no lot', nouvelOperateur],
  ])('answers %s the same 404 for Parking Démo', async (_case, user) => {
    const cookies = await signedIn(user);

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/occupancy`, cookies });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(LOT_NOT_FOUND);
  });

  it('gives Pierre his own Garage Roy, with no level and nothing to check', async () => {
    const cookies = await signedIn(pierre);

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/occupancy`, cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ lotId: GARAGE_ROY_ID, levels: [], occupiedOrAssignedCount: 0, counterGap: { kind: 'SPOTS_TO_CHECK', spots: 0 } });
  });

  it('refuses a forged dashboard cookie like no session', async () => {
    ({ server } = startDashboardServer());

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/occupancy`, cookies: { palier_dashboard: 'forged' } });

    expect(response.statusCode).toBe(401);
  });

  it('offers no write on the occupancy path', async () => {
    const cookies = await signedIn(sophie);

    const response = await server.inject({ method: 'POST', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/occupancy`, cookies });

    expect(response.statusCode).toBe(404);
  });
});
