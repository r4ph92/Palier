import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };
const UNKNOWN_LOT = '00000000-0000-4000-8000-000000000999';

describe('GET /v1/dashboard/lots/:id/exits', () => {
  let server: FastifyInstance;

  beforeEach(() => {
    ({ server } = startDashboardServer());
  });

  afterEach(() => server.close());

  async function exitsOf(user: typeof sophie, lotId: string) {
    const cookies = await dashboardCookieFor(server, user);
    return server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/exits`, cookies });
  }

  it('gives Sophie the exit counts of Parking Démo by identification method', async () => {
    const response = await exitsOf(sophie, PARKING_DEMO_ID);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ lotName: 'Parking Démo', totalExits: 10, counts: { BEACON: 5, APP: 3, PLATE: 2, TRANSPONDER: 0, STAFF: 0 } });
  });

  it('answers Pierre the same 404 for Parking Démo as for an unknown id and a malformed one', async () => {
    const responses = [await exitsOf(pierre, PARKING_DEMO_ID), await exitsOf(pierre, UNKNOWN_LOT), await exitsOf(pierre, 'not-a-uuid')];

    for (const response of responses) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(LOT_NOT_FOUND);
    }
  });

  it('refuses a visitor with no session', async () => {
    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/exits` });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'UNAUTHORIZED' });
  });
});
