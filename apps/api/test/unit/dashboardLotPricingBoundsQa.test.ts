import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { garageRoyDetails, type FakeLotStore } from './fakes/fakeLotSetupRepository.ts';

const royPricing = { incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 };

describe('pricing bounds through PUT /v1/dashboard/lots/:id/pricing, verification round (QA #64)', () => {
  let server: FastifyInstance;
  let lots: FakeLotStore;

  afterEach(() => server.close());

  async function putPricingAs(user: typeof pierre, payload: object) {
    ({ server, lots } = startDashboardServer());
    const cookies = await dashboardCookieFor(server, user);
    return server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${garageRoyDetails.id}/pricing`, cookies, headers: writeHeader, payload });
  }

  it.each([
    ['a 5-minute increment', { incrementMinutes: 5 }],
    ['a 60-minute increment', { incrementMinutes: 60 }],
    ['a cap equal to one increment', { incrementCents: 1800, dailyCapCents: 1800 }],
    ['0,50 $ for both the increment and the cap', { incrementCents: 50, dailyCapCents: 50 }],
    ['no guarantee at all', { holdQuota: 0 }],
    ['50 guarantees', { holdQuota: 50 }],
  ])('saves %s', async (_case, change) => {
    const pricing = { ...royPricing, ...change };

    const response = await putPricingAs(pierre, pricing);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ pricing });
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(pricing);
  });

  it.each([
    ['a cap one cent under the increment', { incrementCents: 1801, dailyCapCents: 1800 }, 'PRICING_DAILY_CAP_BELOW_INCREMENT'],
    ['a cap of 0,49 $ under an increment of 0,50 $', { incrementCents: 50, dailyCapCents: 49 }, 'PRICING_DAILY_CAP_INVALID'],
    ['a zero cap', { dailyCapCents: 0 }, 'PRICING_DAILY_CAP_INVALID'],
    ['a cap above 100 000,00 $', { dailyCapCents: 10_000_001 }, 'PRICING_DAILY_CAP_INVALID'],
    ['a cap of 1e20 cents, an integer to JSON Schema', { dailyCapCents: 1e20 }, 'PRICING_DAILY_CAP_INVALID'],
  ])('refuses %s and keeps the saved pricing', async (_case, change, error) => {
    const response = await putPricingAs(pierre, { ...royPricing, ...change });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error });
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(garageRoyDetails.pricing);
  });

  it.each([
    ['an empty-string cap', { dailyCapCents: '' }],
    ['a cap sent as text', { dailyCapCents: '1800' }],
    ['a fractional number of minutes', { incrementMinutes: 20.5 }],
    ['a boolean quota', { holdQuota: true }],
  ])('refuses %s as a malformed body and keeps the saved pricing', async (_case, change) => {
    const response = await putPricingAs(pierre, { ...royPricing, ...change });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'FST_ERR_VALIDATION' });
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(garageRoyDetails.pricing);
  });

  it('gives Sophie the same not found on Pierre’s lot with the bounds pricing, and changes nothing', async () => {
    const response = await putPricingAs(sophie, { incrementCents: 50, incrementMinutes: 60, dailyCapCents: 50, holdQuota: 0 });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(garageRoyDetails.pricing);
  });
});
