import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { SpotHold } from '../../src/domain/spotHolds/SpotHold.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { authorizationFor, marc } from './fakeDriverRepository.ts';
import { fakeSpotHoldId } from './fakes/fakeSpotHolds.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const AT_14_17 = new Date('2026-11-04T19:17:00Z');
const JUST_BEFORE_14_17 = new Date(AT_14_17.getTime() - 1);
const JULIE_HOLD = fakeSpotHoldId(1);
const NOT_FOUND_BODY = { statusCode: 404, error: 'HOLD_NOT_FOUND', message: 'No such hold.' };
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('QA release a spot hold: hostile requests', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieHolding() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    const askedIds: string[] = [];
    const findOwn = configured.spotHolds.findOwnActiveSpotHold.bind(configured.spotHolds);
    // Postgres reads the id as uuid: text it cannot cast fails the query instead of matching nothing.
    configured.spotHolds.findOwnActiveSpotHold = (driverId: string, spotHoldId: string): Promise<SpotHold | null> => {
      askedIds.push(spotHoldId);
      return CANONICAL_UUID.test(spotHoldId) ? findOwn(driverId, spotHoldId) : Promise.reject(new Error(`invalid input syntax for type uuid: "${spotHoldId}"`));
    };
    const release = (path: string, asHeaders: Record<string, string> = headers): Promise<LightMyRequestResponse> =>
      server.inject({ method: 'DELETE', url: `/v1/holds/${path}`, headers: asHeaders });
    return { ...configured, headers, release, askedIds };
  }

  it.each([
    ['Julie’s own id behind a urn:uuid: prefix', `urn:uuid:${JULIE_HOLD}`],
    ['an unknown id behind an uppercase URN:UUID: prefix', `URN:UUID:${fakeSpotHoldId(99)}`],
  ])('answers the unknown-id 404 to %s, never a 500, and asks the database nothing', async (_case, path) => {
    const { release, spotHolds, askedIds } = await startWithJulieHolding();

    const response = await release(path);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND_BODY);
    expect(askedIds.filter((id) => !CANONICAL_UUID.test(id))).toEqual([]);
    expect(spotHolds.releases).toHaveLength(0);
  });

  it.each([
    ['a junk id', 'junk'],
    ['a urn:uuid: id', `urn:uuid:${JULIE_HOLD}`],
  ])('answers 401 to %s without a token and 403 to Marc before he accepts the notice, before the path is read', async (_case, path) => {
    const { release, driverRepository, askedIds } = await startWithJulieHolding();

    const anonymous = await server.inject({ method: 'DELETE', url: `/v1/holds/${path}` });
    const withoutConsent = await release(path, await authorizationFor(driverRepository, marc));

    expect(anonymous.statusCode).toBe(401);
    expect(withoutConsent.statusCode).toBe(403);
    expect(withoutConsent.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
    expect(askedIds).toEqual([]);
  });

  it.each(['GET', 'POST', 'PUT', 'PATCH'] as const)('releases nothing on %s /v1/holds/:id', async (method) => {
    const { headers, spotHolds } = await startWithJulieHolding();

    const response = await server.inject({ method, url: `/v1/holds/${JULIE_HOLD}`, headers });

    expect(response.statusCode).toBe(404);
    expect(spotHolds.releases).toHaveLength(0);
  });

  it('ignores a body naming another driver: the token decides whose hold is released', async () => {
    const { release, driverRepository, vehicleRepository, spotHolds } = await startWithJulieHolding();
    const marcHeaders = await readyDriver(driverRepository, vehicleRepository, marc);

    const response = await server.inject({
      method: 'DELETE',
      url: `/v1/holds/${JULIE_HOLD}`,
      headers: { ...marcHeaders, 'content-type': 'application/json' },
      payload: { driverId: '00000000-0000-4000-8000-000000000501' },
    });

    expect(response.json()).toEqual(NOT_FOUND_BODY);
    expect(spotHolds.releases).toHaveLength(0);
    expect((await release(JULIE_HOLD)).statusCode).toBe(204);
  });
});

describe('QA release a spot hold: the expiry boundary', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieHoldingUntil1417() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    const release = () => server.inject({ method: 'DELETE', url: `/v1/holds/${JULIE_HOLD}`, headers });
    const currentHold = async () => (await server.inject({ method: 'GET', url: '/v1/me/hold', headers })).json<{ spotHold: unknown }>().spotHold;
    return { ...configured, release, currentHold };
  }

  it('releases one millisecond before the hold lapses', async () => {
    const { release, testClock, spotHolds, currentHold } = await julieHoldingUntil1417();
    testClock.setFixed(JUST_BEFORE_14_17);

    expect((await release()).statusCode).toBe(204);
    expect(spotHolds.releases).toEqual([expect.objectContaining({ releasedAt: JUST_BEFORE_14_17 })]);
    expect(await currentHold()).toBeNull();
  });

  it('answers the same 409 to a second tap on an expired hold, which stays the driver’s', async () => {
    const { release, testClock, spotHolds, currentHold } = await julieHoldingUntil1417();
    testClock.setFixed(AT_14_17);

    const first = await release();
    const second = await release();

    expect(first.statusCode).toBe(409);
    expect(second.body).toBe(first.body);
    expect(spotHolds.releases).toHaveLength(0);
    expect(await currentHold()).toMatchObject({ spotHoldId: JULIE_HOLD });
  });
});
