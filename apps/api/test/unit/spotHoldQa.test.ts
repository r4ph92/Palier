import type { SpotHoldRefusalCode } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { connectToDatabase } from '../../src/infrastructure/postgres/database.ts';
import { HELD_SPOT_COUNT } from '../../src/infrastructure/postgres/heldSpotCount.ts';
import { parkingLot } from '../../src/infrastructure/postgres/schema.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { authorizationFor, marc } from './fakeDriverRepository.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const REFUSALS: readonly SpotHoldRefusalCode[] = [
  'PREREQUISITES_MISSING',
  'HOLD_ALREADY_EXISTS',
  'HOLD_QUOTA_REACHED',
  'NO_SUITABLE_SPOT',
  'LOT_NOT_FOUND',
  'LOT_NOT_IN_SERVICE',
  'HOLD_UNAVAILABLE',
  'TOO_MANY_HOLD_ATTEMPTS',
];

describe('QA spot hold: the free count', () => {
  it('reads the lot of a held spot as the lot being listed, not as the spot', async () => {
    const connection = connectToDatabase('postgres://nobody:nothing@127.0.0.1:1/never_connected');
    try {
      const { sql } = connection.database.select({ id: parkingLot.id, held: HELD_SPOT_COUNT }).from(parkingLot).toSQL();

      // Drizzle leaves a column of the only table in the query unqualified, so inside the subquery "id" is spot.id:
      // the held count would always be 0 and a lot full by capacity minus vehicles would keep offering the spot.
      expect(sql).not.toMatch(/spot\.lot_id = "id"/);
      expect(sql).toContain('spot.lot_id = parking_lot.id');
    } finally {
      await connection.close();
    }
  });
});

describe('QA spot hold: hostile requests', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const post = (lotId: string, requestHeaders: Record<string, string> = headers) =>
      server.inject({ method: 'POST', url: `/v1/lots/${lotId}/holds`, headers: requestHeaders });
    return { ...configured, headers, post };
  }

  it.each([
    ['an empty-looking id', '%20'],
    ['an uppercase id of the wrong length', 'ABCDEF'],
    ['a UUID with a letter past f', '00000000-0000-4000-8000-00000000020G'],
    ['a UUID without dashes', '00000000000040008000000000000201'],
    ['a UUID with a trailing space', `${PARKING_DEMO_ID}%20`],
    ['a UUID with a null byte', `${PARKING_DEMO_ID}%00`],
    ['an emoji', encodeURIComponent('🚗')],
    ['a script tag', encodeURIComponent('<script>alert(1)</script>')],
    ['a SQL comment', encodeURIComponent("'; drop table spot_hold; --")],
    ['a path traversal', '..%2F..%2Fme'],
  ])('answers 404 LOT_NOT_FOUND to %s, never a 500', async (_case, lotId) => {
    const { post, spotHolds } = await startWithJulieReady();

    const response = await post(lotId);

    expect(response.statusCode).toBe(404);
    expect(response.statusCode).not.toBe(500);
    expect(spotHolds.drafts).toHaveLength(0);
  });

  it('asks for a token before it looks at the lot id', async () => {
    const { post } = await startWithJulieReady();

    const response = await post('not-a-uuid', {});

    expect(response.statusCode).toBe(401);
  });

  it('asks for the notice before it looks at the lot id', async () => {
    const { post, driverRepository } = await startWithJulieReady();

    const response = await post('not-a-uuid', await authorizationFor(driverRepository, marc));

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
  });

  it('ignores a driver id smuggled into the query string or the body', async () => {
    const { headers, driverRepository, vehicleRepository, spotHolds } = await startWithJulieReady();
    const marcHeaders = await readyDriver(driverRepository, vehicleRepository, marc);

    const response = await server.inject({
      method: 'POST',
      url: `/v1/lots/${PARKING_DEMO_ID}/holds?userId=${marc.id}&driverId=${marc.id}`,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { userId: marc.id, driverId: marc.id, spotNumber: 'A-1', expiresAt: '2099-01-01T00:00:00Z' },
    });

    expect(response.statusCode).toBe(201);
    expect(spotHolds.drafts).toHaveLength(1);
    expect(spotHolds.drafts[0]?.driverId).not.toBe(marc.id);
    const marcsHold = await server.inject({ method: 'GET', url: '/v1/me/hold', headers: marcHeaders });
    expect(marcsHold.json()).toEqual({ spotHold: null });
  });

  it('answers 404 to the verbs the story does not offer', async () => {
    const { headers } = await startWithJulieReady();

    for (const [method, url] of [
      ['DELETE', '/v1/me/hold'],
      ['POST', '/v1/me/hold'],
      ['PUT', `/v1/lots/${PARKING_DEMO_ID}/holds`],
      ['GET', `/v1/lots/${PARKING_DEMO_ID}/holds`],
    ] as const) {
      expect((await server.inject({ method, url, headers })).statusCode, `${method} ${url}`).toBe(404);
    }
  });

  it.each(REFUSALS)('answers %s with the three envelope fields and no spot, plate or card detail', async (reason) => {
    const { post, spotHolds } = await startWithJulieReady();
    spotHolds.refusal = reason;

    const response = await post(PARKING_DEMO_ID);

    expect(Object.keys(response.json()).sort()).toEqual(['error', 'message', 'statusCode']);
    expect(response.body).not.toMatch(/\b[A-D]-\d\b|ABC ?123|pm_|cus_/);
  });
});

describe('QA spot hold: the attempt limiter', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('gives back the attempt of a request that timed out on the lot lock, so busy lots never lock a driver out', async () => {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    configured.spotHolds.refusal = 'HOLD_UNAVAILABLE';
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const busy = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
      expect(busy.statusCode).toBe(503);
    }
    configured.spotHolds.refusal = null;

    const response = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });

    expect(response.statusCode).toBe(201);
  });

  it('counts the attempts of each driver on their own', async () => {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    const julieHeaders = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const marcHeaders = await readyDriver(configured.driverRepository, configured.vehicleRepository, marc);
    configured.spotHolds.refusal = 'NO_SUITABLE_SPOT';
    for (let attempt = 0; attempt < 11; attempt += 1) {
      await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers: julieHeaders });
    }

    const julieAgain = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers: julieHeaders });
    const marcFirst = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers: marcHeaders });

    expect(julieAgain.statusCode).toBe(429);
    expect(marcFirst.statusCode).toBe(409);
  });

  it('does not count a request refused before the lot lock, such as a second hold', async () => {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const again = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
      expect(again.json()).toMatchObject({ error: 'HOLD_ALREADY_EXISTS' });
    }
  });
});
