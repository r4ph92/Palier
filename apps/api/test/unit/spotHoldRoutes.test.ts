import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, marc } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { STRICT_POLICY } from './fakes/entryGateFakes.ts';
import { FakeSpotHoldRepository, fakeSpotHoldId } from './fakes/fakeSpotHolds.ts';
import { readyDriver } from './fakes/readyDriver.ts';
import { fakeRepositories, serverDependencies } from './fakes/serverDependencies.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const UNKNOWN_LOT_ID = '00000000-0000-4000-8000-000000000299';

describe('POST /v1/lots/:id/holds', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const hold = (lotId: string = PARKING_DEMO_ID) => server.inject({ method: 'POST', url: `/v1/lots/${lotId}/holds`, headers });
    return { ...configured, headers, hold };
  }

  it('guarantees Julie a spot at Parking Démo from 14 h 02 until 14 h 17, by the API clock', async () => {
    const { hold } = await startWithJulieReady();

    const response = await hold();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      spotHoldId: fakeSpotHoldId(1),
      lotId: PARKING_DEMO_ID,
      lotName: 'Parking Démo',
      expiresAt: '2026-11-04T19:17:00.000Z',
      now: '2026-11-04T19:02:00.000Z',
    });
  });

  it('answers a second request with HOLD_ALREADY_EXISTS and keeps one hold, in the same lot or another', async () => {
    const { hold, spotHolds } = await startWithJulieReady();
    await hold();

    const sameLot = await hold();
    const otherLot = await hold(GARAGE_ROY_ID);

    expect(sameLot.statusCode).toBe(409);
    expect(sameLot.json()).toEqual({ statusCode: 409, error: 'HOLD_ALREADY_EXISTS', message: 'You already hold a spot.' });
    expect(otherLot.json()).toMatchObject({ error: 'HOLD_ALREADY_EXISTS' });
    expect(spotHolds.drafts).toHaveLength(1);
  });

  it.each([
    ['HOLD_QUOTA_REACHED', 409],
    ['NO_SUITABLE_SPOT', 409],
    ['HOLD_UNAVAILABLE', 503],
  ] as const)('answers %s with %i when the lot lock refuses', async (reason, statusCode) => {
    const { hold, spotHolds } = await startWithJulieReady();
    spotHolds.refusal = reason;

    const response = await hold();

    expect(response.statusCode).toBe(statusCode);
    expect(response.json()).toMatchObject({ statusCode, error: reason });
  });

  it('refuses Marc without plate or card with PREREQUISITES_MISSING and places nothing', async () => {
    const { driverRepository, spotHolds } = await startWithJulieReady();
    await acceptNoticeAs(driverRepository, marc);
    const headers = await authorizationFor(driverRepository, marc);

    const response = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ statusCode: 409, error: 'PREREQUISITES_MISSING', message: 'Add a plate and a card before holding a spot.' });
    expect(spotHolds.drafts).toHaveLength(0);
  });

  it('refuses a driver who has not accepted the notice with 403 CONSENT_REQUIRED before anything else', async () => {
    const { driverRepository, spotHolds } = await startWithJulieReady();
    const headers = await authorizationFor(driverRepository, marc);

    const response = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
    expect(spotHolds.drafts).toHaveLength(0);
  });

  it.each([
    ['an unknown lot id', UNKNOWN_LOT_ID],
    ['a lot id that is not a UUID', 'parking-demo'],
    ['a lot id with SQL in it', "1' or '1'='1"],
  ])('answers 404 LOT_NOT_FOUND to %s', async (_case, lotId) => {
    const { hold } = await startWithJulieReady();

    const response = await hold(encodeURIComponent(lotId));

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' });
  });

  it('refuses the offline Garage Roy with LOT_NOT_IN_SERVICE', async () => {
    const { hold } = await startWithJulieReady();

    expect((await hold(GARAGE_ROY_ID)).json()).toMatchObject({ statusCode: 409, error: 'LOT_NOT_IN_SERVICE' });
  });

  it('answers 429 TOO_MANY_HOLD_ATTEMPTS past 10 attempts in 10 minutes', async () => {
    const { hold, spotHolds } = await startWithJulieReady();
    spotHolds.refusal = 'NO_SUITABLE_SPOT';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await hold();
    }

    const response = await hold();

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({ statusCode: 429, error: 'TOO_MANY_HOLD_ATTEMPTS', message: 'Too many attempts. Try again in a few minutes.' });
    expect(spotHolds.drafts).toHaveLength(10);
  });

  it('never answers a field the response schema does not list, so a spot number cannot leak', async () => {
    const driverRepository = new FakeDriverRepository();
    const vehicleRepository = new FakeVehicleRepository();
    const leaking = new FakeSpotHoldRepository();
    const place = leaking.placeSpotHold.bind(leaking);
    leaking.placeSpotHold = async (draft) => Object.assign(await place(draft), { spotNumber: 'A-1' });
    server = buildServer(serverDependencies({ repositories: fakeRepositories({ driverRepository, vehicleRepository }), spotHolds: { repository: leaking, policy: STRICT_POLICY } }));
    const headers = await readyDriver(driverRepository, vehicleRepository);

    const response = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });

    expect(response.statusCode).toBe(201);
    expect(response.body).not.toContain('A-1');
  });

  it('answers 503 HOLD_UNAVAILABLE on a server built without spot holds', async () => {
    const driverRepository = new FakeDriverRepository();
    const vehicleRepository = new FakeVehicleRepository();
    server = buildServer(serverDependencies({ repositories: fakeRepositories({ driverRepository, vehicleRepository }) }));
    const headers = await readyDriver(driverRepository, vehicleRepository);

    const response = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'HOLD_UNAVAILABLE' });
  });
});

describe('GET /v1/me/hold', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const readHold = (asHeaders = headers) => server.inject({ method: 'GET', url: '/v1/me/hold', headers: asHeaders });
    return { ...configured, headers, readHold };
  }

  it('answers no hold for a driver who has none', async () => {
    const { readHold } = await startWithJulieReady();

    expect((await readHold()).json()).toEqual({ spotHold: null });
  });

  it('gives Julie her hold back after a relaunch, with the API clock\'s now', async () => {
    const { readHold, headers, testClock } = await startWithJulieReady();
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    testClock.setFixed(new Date('2026-11-04T19:05:30Z'));

    expect((await readHold()).json()).toEqual({
      spotHold: { spotHoldId: fakeSpotHoldId(1), lotId: PARKING_DEMO_ID, lotName: 'Parking Démo', expiresAt: '2026-11-04T19:17:00.000Z', now: '2026-11-04T19:05:30.000Z' },
    });
  });

  it('shows Marc nothing of Julie\'s hold', async () => {
    const { readHold, headers, driverRepository, vehicleRepository } = await startWithJulieReady();
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    const marcHeaders = await readyDriver(driverRepository, vehicleRepository, marc);

    expect((await readHold(marcHeaders)).json()).toEqual({ spotHold: null });
  });

  it('answers 401 without a driver token', async () => {
    await startWithJulieReady();

    expect((await server.inject({ method: 'GET', url: '/v1/me/hold' })).statusCode).toBe(401);
  });
});
