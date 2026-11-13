import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';

const garageRoyNord = { name: 'Garage Roy Nord', address: '8000, boulevard Saint-Laurent, Montréal', latitude: 45.54, longitude: -73.62, capacity: 40 };
const BURST = 50;
const TOO_MANY_REQUESTS = 429;

// Each created lot takes a beacon major for good from one platform-wide sequence that ends at 65 535 (decision 032).
describe('a burst of lot creations by one operator (QA #64)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('answers 429 before one member can spend the platform’s beacon majors on fifty lots in a row', async () => {
    const started = startDashboardServer();
    server = started.server;
    const cookies = await dashboardCookieFor(server, pierre);
    const lotsBefore = started.lots.owned.length;

    const statuses: number[] = [];
    for (let attempt = 0; attempt < BURST; attempt += 1) {
      const response = await server.inject({ method: 'POST', url: '/v1/dashboard/lots', cookies, headers: writeHeader, payload: garageRoyNord });
      statuses.push(response.statusCode);
    }

    expect(statuses).toContain(TOO_MANY_REQUESTS);
    expect(started.lots.owned.length - lotsBefore).toBeLessThan(BURST);
  });
});
