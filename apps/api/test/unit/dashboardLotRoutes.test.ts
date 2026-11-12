import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { julie } from './fakeDriverRepository.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { garageRoyDetails, type FakeLotStore } from './fakes/fakeLotSetupRepository.ts';

const garageRoyNord = { name: 'Garage Roy Nord', address: '8000, boulevard Saint-Laurent, Montréal', latitude: 45.54, longitude: -73.62, capacity: 40 };
const royPricing = { incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 };
const LOT_CREATIONS_PER_HOUR = 10;
const ONE_HOUR_IN_SECONDS = 3600;
const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };

describe('dashboard lot setup routes', () => {
  let server: FastifyInstance;
  let lots: FakeLotStore;

  afterEach(() => server.close());

  async function signIn(user: typeof pierre) {
    ({ server, lots } = startDashboardServer());
    return dashboardCookieFor(server, user);
  }

  function createLot(cookies: Record<string, string>, payload: object = garageRoyNord) {
    return server.inject({ method: 'POST', url: '/v1/dashboard/lots', cookies, headers: writeHeader, payload });
  }

  function putPricing(cookies: Record<string, string>, lotId: string, payload: object = royPricing) {
    return server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${lotId}/pricing`, cookies, headers: writeHeader, payload });
  }

  it('creates Garage Roy Nord offline, without pricing, with the next beacon major, and lists it for Pierre', async () => {
    const cookies = await signIn(pierre);

    const created = await createLot(cookies);
    const list = await server.inject({ method: 'GET', url: '/v1/dashboard/lots', cookies });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({ ...garageRoyNord, id: expect.any(String), isOnline: false, beaconMajor: expect.any(Number), pricing: null });
    expect(list.json()).toEqual([
      { id: garageRoyDetails.id, name: 'Garage Roy', isOnline: false },
      { id: created.json<{ id: string }>().id, name: 'Garage Roy Nord', isOnline: false },
    ]);
  });

  it('does not count refused creations against the hourly allowance', async () => {
    const cookies = await signIn(pierre);
    for (let refused = 0; refused < LOT_CREATIONS_PER_HOUR; refused += 1) {
      expect((await createLot(cookies, { ...garageRoyNord, name: '   ' })).statusCode).toBe(400);
    }

    expect((await createLot(cookies)).statusCode).toBe(201);
  });

  it('lets Pierre create ten lots in an hour, refuses the eleventh with Retry-After, and still lets Sophie create hers', async () => {
    const cookies = await signIn(pierre);
    for (let created = 0; created < LOT_CREATIONS_PER_HOUR; created += 1) {
      await createLot(cookies);
    }

    const eleventh = await createLot(cookies);
    const sophies = await createLot(await dashboardCookieFor(server, sophie));

    expect(eleventh.statusCode).toBe(429);
    expect(eleventh.headers['retry-after']).toBe(String(ONE_HOUR_IN_SECONDS));
    expect(eleventh.json()).toMatchObject({ error: 'TOO_MANY_LOTS' });
    expect(sophies.statusCode).toBe(201);
  });

  it('stores the name and address without their surrounding spaces', async () => {
    const cookies = await signIn(pierre);

    const created = await createLot(cookies, { ...garageRoyNord, name: '  Garage Roy Nord ', address: '\t8000, boulevard Saint-Laurent ' });

    expect(created.json()).toMatchObject({ name: 'Garage Roy Nord', address: '8000, boulevard Saint-Laurent' });
  });

  it('saves 1,00 $ per 20 minutes, a cap of 18,00 $ and a quota of 4 on Garage Roy, and shows it on the lot', async () => {
    const cookies = await signIn(pierre);

    const saved = await putPricing(cookies, garageRoyDetails.id);
    const read = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${garageRoyDetails.id}`, cookies });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ ...garageRoyDetails, pricing: royPricing });
    expect(read.json()).toEqual(saved.json());
  });

  it('refuses a missing daily cap with PRICING_DAILY_CAP_REQUIRED and keeps the pricing', async () => {
    const cookies = await signIn(pierre);

    const response = await putPricing(cookies, garageRoyDetails.id, { ...royPricing, dailyCapCents: null });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'PRICING_DAILY_CAP_REQUIRED' });
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(garageRoyDetails.pricing);
  });

  it.each([
    ['a zero increment price', { incrementCents: 0 }, 'PRICING_INCREMENT_CENTS_INVALID'],
    ['a negative increment price', { incrementCents: -100 }, 'PRICING_INCREMENT_CENTS_INVALID'],
    ['a 4-minute increment', { incrementMinutes: 4 }, 'PRICING_INCREMENT_MINUTES_INVALID'],
    ['a 61-minute increment', { incrementMinutes: 61 }, 'PRICING_INCREMENT_MINUTES_INVALID'],
    ['a cap under one increment', { dailyCapCents: 50 }, 'PRICING_DAILY_CAP_BELOW_INCREMENT'],
    ['a hold quota of 51', { holdQuota: 51 }, 'PRICING_HOLD_QUOTA_INVALID'],
  ])('refuses %s with its code and keeps the pricing', async (_case, change, error) => {
    const cookies = await signIn(pierre);

    const response = await putPricing(cookies, garageRoyDetails.id, { ...royPricing, ...change });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error });
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(garageRoyDetails.pricing);
  });

  it('gives Sophie not found when she reads or prices Garage Roy, and changes nothing', async () => {
    const cookies = await signIn(sophie);

    const read = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${garageRoyDetails.id}`, cookies });
    const priced = await putPricing(cookies, garageRoyDetails.id);

    expect(read.json()).toEqual(LOT_NOT_FOUND);
    expect(priced.json()).toEqual(LOT_NOT_FOUND);
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(garageRoyDetails.pricing);
  });

  it('asks Julie, who has no operator, to create one before a lot, and gives her not found on pricing', async () => {
    const cookies = await signIn(julie);

    const created = await createLot(cookies);
    const priced = await putPricing(cookies, garageRoyDetails.id);

    expect(created.statusCode).toBe(409);
    expect(created.json()).toMatchObject({ error: 'NO_OPERATOR' });
    expect(priced.json()).toEqual(LOT_NOT_FOUND);
  });

  it('gives not found for a malformed lot id with a valid body, and 400 for a valid id with a wrong body', async () => {
    const cookies = await signIn(pierre);

    const malformedId = await putPricing(cookies, 'abc');
    const wrongBody = await putPricing(cookies, garageRoyDetails.id, { ...royPricing, incrementCents: '100' });

    expect(malformedId.json()).toEqual(LOT_NOT_FOUND);
    expect(wrongBody.statusCode).toBe(400);
  });

  it('answers null, never 0, for a lot without coordinates or beacon major', async () => {
    const cookies = await signIn(pierre);
    lots.owned[lots.indexOf(ROY_OPERATOR_ID, garageRoyDetails.id)] = { ...garageRoyDetails, operatorId: ROY_OPERATOR_ID, latitude: null, longitude: null, beaconMajor: null };

    const read = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${garageRoyDetails.id}`, cookies });

    expect(read.json()).toMatchObject({ latitude: null, longitude: null, beaconMajor: null });
  });

  it('refuses both writes without the dashboard header', async () => {
    const cookies = await signIn(pierre);

    const created = await server.inject({ method: 'POST', url: '/v1/dashboard/lots', cookies, payload: garageRoyNord });
    const priced = await server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${garageRoyDetails.id}/pricing`, cookies, payload: royPricing });

    expect([created.statusCode, priced.statusCode]).toEqual([403, 403]);
    expect(lots.owned).toHaveLength(3);
  });
});
