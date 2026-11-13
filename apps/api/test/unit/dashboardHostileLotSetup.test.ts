import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { garageRoyDetails, type FakeLotStore } from './fakes/fakeLotSetupRepository.ts';

const garageRoyNord = { name: 'Garage Roy Nord', address: '8000, boulevard Saint-Laurent, Montréal', latitude: 45.54, longitude: -73.62, capacity: 40 };
const royPricing = { incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 };

describe('hostile lot setup requests', () => {
  let server: FastifyInstance;
  let lots: FakeLotStore;
  let cookies: Record<string, string>;

  afterEach(() => server.close());

  async function signInPierre() {
    ({ server, lots } = startDashboardServer());
    cookies = await dashboardCookieFor(server, pierre);
  }

  function createLot(payload: object | string) {
    return server.inject({ method: 'POST', url: '/v1/dashboard/lots', cookies, headers: { ...writeHeader, 'content-type': 'application/json' }, payload });
  }

  function putPricing(payload: object | string) {
    const headers = { ...writeHeader, 'content-type': 'application/json' };
    return server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${garageRoyDetails.id}/pricing`, cookies, headers, payload });
  }

  it('ignores an operator, a state, a beacon major and a vehicle count sent with a new lot', async () => {
    await signInPierre();

    const created = await createLot({ ...garageRoyNord, operatorId: '00000000-0000-4000-8000-000000000101', isOnline: true, beaconMajor: 1, vehicleCount: 99 });

    expect(created.statusCode).toBe(201);
    const stored = lots.byId(created.json<{ id: string }>().id);
    expect(created.json()).toMatchObject({ isOnline: false, pricing: null });
    expect(created.json()).not.toMatchObject({ beaconMajor: 1 });
    expect(stored).toMatchObject({ operatorId: ROY_OPERATOR_ID, isOnline: false });
    expect(stored).not.toHaveProperty('vehicleCount');
  });

  it.each([
    ['a name holding NUL', { name: 'Garage\u0000Nord' }, 'LOT_NAME_INVALID'],
    ['an address of zero-width spaces', { address: '​​' }, 'LOT_ADDRESS_INVALID'],
    ['a latitude of 1e300', { latitude: 1e300 }, 'LOT_LATITUDE_INVALID'],
    ['a fractional capacity', { capacity: 40.5 }, 'FST_ERR_VALIDATION'],
    ['a capacity given as text', { capacity: '40' }, 'FST_ERR_VALIDATION'],
    ['a capacity past the limit', { capacity: 1e300 }, 'LOT_CAPACITY_INVALID'],
  ])('refuses a new lot with %s', async (_case, change, error) => {
    await signInPierre();

    const response = await createLot({ ...garageRoyNord, ...change });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error });
    expect(lots.owned).toHaveLength(3);
  });

  it('refuses NaN, which JSON cannot carry, as a malformed body', async () => {
    await signInPierre();

    const response = await createLot('{"name":"N","address":"A","latitude":NaN,"longitude":0,"capacity":1}');

    expect(response.statusCode).toBe(400);
  });

  it('stores an HTML lot name verbatim', async () => {
    await signInPierre();
    const name = '<b>x</b><script>alert(1)</script>';

    expect((await createLot({ ...garageRoyNord, name })).json()).toMatchObject({ name });
  });

  it.each([
    ['a cap of 0,49 $', { incrementCents: 50, dailyCapCents: 49 }, 'PRICING_DAILY_CAP_INVALID'],
    ['a cap one cent past 100 000,00 $', { dailyCapCents: 10_000_001 }, 'PRICING_DAILY_CAP_INVALID'],
    ['an increment price of 1e300', { incrementCents: 1e300 }, 'PRICING_INCREMENT_CENTS_INVALID'],
    ['a fractional increment length', { incrementMinutes: 20.5 }, 'FST_ERR_VALIDATION'],
    ['a cap given as text', { dailyCapCents: '1800' }, 'FST_ERR_VALIDATION'],
    ['a missing hold quota', { holdQuota: undefined }, 'FST_ERR_VALIDATION'],
  ])('refuses pricing with %s and keeps the lot as it was', async (_case, change, error) => {
    await signInPierre();

    const response = await putPricing({ ...royPricing, ...change });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error });
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(garageRoyDetails.pricing);
  });

  it.each([
    ['the smallest cap Stripe charges, 0,50 $', { incrementCents: 50, dailyCapCents: 50 }],
    ['the largest amounts, 100 000,00 $', { incrementCents: 10_000_000, dailyCapCents: 10_000_000 }],
  ])('saves %s', async (_case, change) => {
    await signInPierre();

    const response = await putPricing({ ...royPricing, ...change });

    expect(response.json()).toMatchObject({ pricing: { ...royPricing, ...change } });
  });
});
