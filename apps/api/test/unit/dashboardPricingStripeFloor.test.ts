import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { DAILY_CAP_CENTS_LIMITS, INCREMENT_CENTS_LIMITS, type LotPricing } from '@palier/shared-types/lotPricing';
import { stayAmount } from '../../src/domain/pricing/priceParkingSessionAt.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { garageRoyDetails, type FakeLotStore } from './fakes/fakeLotSetupRepository.ts';

// Stripe refuses any CAD charge, capture included, under 0,50 $ (docs.stripe.com/currencies). lotPricing.ts floors the cap here but the increment at 1 cent.
const STRIPE_CAD_MINIMUM_CENTS = 50;

// The exit captures min(authorization = daily cap, amount billed so far): EntryEligibility.ts:60 and exitParking.ts:59-60.
function exitCaptureCents(pricing: LotPricing, elapsedMinutes: number): number {
  return Math.min(pricing.dailyCapCents, stayAmount(pricing, elapsedMinutes));
}

describe('a lot priced with an increment below Stripe’s CAD minimum (#64 attack surface)', () => {
  let server: FastifyInstance | undefined;
  let lots: FakeLotStore;

  afterEach(async () => server?.close());

  const floorBreakingPricing = { incrementCents: 1, incrementMinutes: 5, dailyCapCents: STRIPE_CAD_MINIMUM_CENTS, holdQuota: 3 };

  async function signInPierre() {
    ({ server, lots } = startDashboardServer());
    return dashboardCookieFor(server, pierre);
  }

  it('floors the daily cap at the Stripe minimum but the increment price far below it', () => {
    expect(DAILY_CAP_CENTS_LIMITS.minimum).toBe(STRIPE_CAD_MINIMUM_CENTS);
    expect(INCREMENT_CENTS_LIMITS.minimum).toBeLessThan(STRIPE_CAD_MINIMUM_CENTS);
  });

  it('saves the one-cent increment through PUT /pricing, then bills short stays below what Stripe will capture', async () => {
    const cookies = await signInPierre();

    const saved = await server.inject({
      method: 'PUT',
      url: `/v1/dashboard/lots/${garageRoyDetails.id}/pricing`,
      cookies,
      headers: writeHeader,
      payload: floorBreakingPricing,
    });

    expect(saved.statusCode).toBe(200);
    const pricing = saved.json<{ pricing: LotPricing }>().pricing;
    expect(pricing).toEqual(floorBreakingPricing);
    expect(lots.byId(garageRoyDetails.id)?.pricing).toEqual(floorBreakingPricing);

    // Entry holds the daily cap, so entry clears the minimum; every stay short of ~4 h bills under it, so the exit capture is refused.
    expect(pricing.dailyCapCents).toBeGreaterThanOrEqual(STRIPE_CAD_MINIMUM_CENTS);
    for (const elapsedMinutes of [1, 10, 60, 240]) {
      const capture = exitCaptureCents(pricing, elapsedMinutes);
      expect(capture).toBeGreaterThan(0);
      expect(capture).toBeLessThan(STRIPE_CAD_MINIMUM_CENTS);
    }
    expect(exitCaptureCents(pricing, 10)).toBe(2);
  });
});
