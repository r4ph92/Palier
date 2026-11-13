import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };
const UNKNOWN_LOT = '00000000-0000-4000-8000-000000000999';

describe('GET /v1/dashboard/lots/:id/occupancy', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function occupancyOf(user: typeof sophie, lotId: string) {
    ({ server } = startDashboardServer());
    const cookies = await dashboardCookieFor(server, user);
    return server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/occupancy`, cookies });
  }

  it('gives Sophie the per-level counts, the counter and the gap of Parking Démo', async () => {
    const response = await occupancyOf(sophie, PARKING_DEMO_ID);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lotId: PARKING_DEMO_ID,
      lotName: 'Parking Démo',
      vehicleCount: 7,
      levels: [{ code: 'P1', counts: { AVAILABLE: 3, HELD: 1, ASSIGNED: 1, OCCUPIED: 3, OCCUPIED_UNKNOWN: 1, OUT_OF_SERVICE: 1 } }],
      occupiedOrAssignedCount: 5,
      counterGap: { kind: 'SPOTS_TO_CHECK', spots: 2 },
    });
  });

  it('answers Pierre the same 404 for Parking Démo as for an unknown id and a malformed one', async () => {
    const other = await occupancyOf(pierre, PARKING_DEMO_ID);
    const unknown = await occupancyOf(pierre, UNKNOWN_LOT);
    const malformed = await occupancyOf(pierre, 'not-a-uuid');

    for (const response of [other, unknown, malformed]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(LOT_NOT_FOUND);
    }
  });

  it('refuses a visitor with no session', async () => {
    ({ server } = startDashboardServer());

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/occupancy` });

    expect(response.statusCode).toBe(401);
  });
});
