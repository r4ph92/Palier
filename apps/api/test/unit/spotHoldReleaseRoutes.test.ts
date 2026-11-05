import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { authorizationFor, FakeDriverRepository, marc } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { fakeSpotHoldId } from './fakes/fakeSpotHolds.ts';
import { readyDriver } from './fakes/readyDriver.ts';
import { fakeRepositories, serverDependencies } from './fakes/serverDependencies.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');

describe('DELETE /v1/holds/:id', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieHolding() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    const release = (id: string = fakeSpotHoldId(1), asHeaders = headers) => server.inject({ method: 'DELETE', url: `/v1/holds/${id}`, headers: asHeaders });
    return { ...configured, headers, release };
  }

  it('releases Julie\'s hold with 204 and no body, and her hold is gone', async () => {
    const { release, headers, spotHolds } = await startWithJulieHolding();

    const response = await release();

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(spotHolds.releases).toHaveLength(1);
    expect((await server.inject({ method: 'GET', url: '/v1/me/hold', headers })).json()).toEqual({ spotHold: null });
  });

  it('answers 404 HOLD_NOT_FOUND to Marc asking for Julie\'s hold, with the body of an unknown id, and keeps her hold', async () => {
    const { release, headers, driverRepository, vehicleRepository, spotHolds } = await startWithJulieHolding();
    const marcHeaders = await readyDriver(driverRepository, vehicleRepository, marc);

    const response = await release(fakeSpotHoldId(1), marcHeaders);
    const unknown = await release(fakeSpotHoldId(99), marcHeaders);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'HOLD_NOT_FOUND', message: 'No such hold.' });
    expect(response.body).toBe(unknown.body);
    expect(spotHolds.releases).toHaveLength(0);
    expect((await server.inject({ method: 'GET', url: '/v1/me/hold', headers })).json()).toMatchObject({ spotHold: { spotHoldId: fakeSpotHoldId(1) } });
  });

  it('answers 409 HOLD_EXPIRED once the 15 minutes have passed, and releases nothing', async () => {
    const { release, testClock, spotHolds } = await startWithJulieHolding();
    testClock.setFixed(new Date('2026-11-04T19:17:00Z'));

    const response = await release();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ statusCode: 409, error: 'HOLD_EXPIRED', message: 'This guarantee has already expired.' });
    expect(spotHolds.releases).toHaveLength(0);
  });

  it('answers 404 to a second release of the same hold', async () => {
    const { release } = await startWithJulieHolding();
    await release();

    expect((await release()).json()).toMatchObject({ error: 'HOLD_NOT_FOUND' });
  });

  it.each([
    ['an id that is not a UUID', 'my-hold'],
    ['an id with SQL in it', encodeURIComponent("1' or '1'='1")],
  ])('answers 404 HOLD_NOT_FOUND to %s', async (_case, id) => {
    const { release, spotHolds } = await startWithJulieHolding();

    const response = await release(id);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'HOLD_NOT_FOUND' });
    expect(spotHolds.releases).toHaveLength(0);
  });

  it('answers 401 without a driver token', async () => {
    await startWithJulieHolding();

    expect((await server.inject({ method: 'DELETE', url: `/v1/holds/${fakeSpotHoldId(1)}` })).statusCode).toBe(401);
  });

  it('answers 403 CONSENT_REQUIRED to a driver who has not accepted the notice', async () => {
    const { release, driverRepository, spotHolds } = await startWithJulieHolding();
    const noConsent = await authorizationFor(driverRepository, marc);

    const response = await release(fakeSpotHoldId(1), noConsent);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
    expect(spotHolds.releases).toHaveLength(0);
  });

  it('answers 503 HOLD_UNAVAILABLE on a server built without spot holds', async () => {
    const driverRepository = new FakeDriverRepository();
    const vehicleRepository = new FakeVehicleRepository();
    server = buildServer(serverDependencies({ repositories: fakeRepositories({ driverRepository, vehicleRepository }) }));
    const headers = await readyDriver(driverRepository, vehicleRepository);

    const response = await server.inject({ method: 'DELETE', url: `/v1/holds/${fakeSpotHoldId(1)}`, headers });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'HOLD_UNAVAILABLE' });
  });
});
