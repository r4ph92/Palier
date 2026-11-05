import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { julie, marc } from './fakeDriverRepository.ts';
import { readyDriver } from './fakes/readyDriver.ts';

// Pentest regression (story #6): the POST body is never read, so it cannot set a privileged field.
// The driver comes from the token, the lot from the path, and the instants from the server clock.
const AT_14_02 = new Date('2026-11-04T19:02:00Z');

describe('POST /v1/lots/:id/holds ignores the request body (mass assignment)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  // A body that tries to steer the hold onto another driver, lot, spot, status and expiry.
  const forgedBody = {
    driverId: marc.id,
    userId: marc.id,
    lotId: GARAGE_ROY_ID,
    spotId: '00000000-0000-4000-8000-0000000000aa',
    spotHoldId: 'forged',
    status: 'USED',
    createdAt: '2099-01-01T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
  };

  it('records the hold under the token driver, the path lot and the server clock, not the body', async () => {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);

    const response = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers, payload: forgedBody });

    expect(response.statusCode).toBe(201);
    expect(configured.spotHolds.drafts).toHaveLength(1);
    const draft = configured.spotHolds.drafts[0];
    if (draft === undefined) {
      throw new Error('expected one recorded draft');
    }
    expect(draft.driverId).toBe(julie.id);
    expect(draft.lotId).toBe(PARKING_DEMO_ID);
    expect(draft.createdAt.toISOString()).toBe('2026-11-04T19:02:00.000Z');
    expect(draft.expiresAt.toISOString()).toBe('2026-11-04T19:17:00.000Z');
  });

  it('answers only the listed fields, so a forged spotId or status cannot echo back', async () => {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);

    const response = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers, payload: forgedBody });

    expect(Object.keys(response.json()).sort()).toEqual(['expiresAt', 'lotId', 'lotName', 'now', 'spotHoldId']);
    expect(response.body).not.toContain('forged');
    expect(response.body).not.toContain('USED');
  });

  it('files the hold under the token driver: the body naming Marc does not make it Marc’s', async () => {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const julieHeaders = await readyDriver(configured.driverRepository, configured.vehicleRepository, julie);
    const marcHeaders = await readyDriver(configured.driverRepository, configured.vehicleRepository, marc);

    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers: julieHeaders, payload: forgedBody });

    expect((await server.inject({ method: 'GET', url: '/v1/me/hold', headers: julieHeaders })).json()).toMatchObject({
      spotHold: { lotId: PARKING_DEMO_ID },
    });
    expect((await server.inject({ method: 'GET', url: '/v1/me/hold', headers: marcHeaders })).json()).toEqual({ spotHold: null });
  });
});
