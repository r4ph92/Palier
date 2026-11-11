import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { DAILY_CAP_CENTS_LIMITS, INCREMENT_CENTS_LIMITS, STRIPE_MINIMUM_CENTS } from '@palier/shared-types/lotPricing';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { garageRoyDetails } from './fakes/fakeLotSetupRepository.ts';

describe('the Stripe CAD minimum on the increment price (#64 attack surface)', () => {
  let server: FastifyInstance | undefined;

  afterEach(async () => server?.close());

  async function putPricing(incrementCents: number) {
    ({ server } = startDashboardServer());
    const cookies = await dashboardCookieFor(server, pierre);
    return server.inject({
      method: 'PUT',
      url: `/v1/dashboard/lots/${garageRoyDetails.id}/pricing`,
      cookies,
      headers: writeHeader,
      payload: { incrementCents, incrementMinutes: 5, dailyCapCents: STRIPE_MINIMUM_CENTS, holdQuota: 3 },
    });
  }

  it('floors the increment price and the daily cap at the same Stripe minimum', () => {
    expect(STRIPE_MINIMUM_CENTS).toBe(50);
    expect(INCREMENT_CENTS_LIMITS.minimum).toBe(STRIPE_MINIMUM_CENTS);
    expect(DAILY_CAP_CENTS_LIMITS.minimum).toBe(STRIPE_MINIMUM_CENTS);
  });

  it('refuses a one-cent increment through PUT /pricing', async () => {
    const response = await putPricing(1);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'PRICING_INCREMENT_CENTS_INVALID' });
  });

  it('accepts an increment at exactly the Stripe minimum', async () => {
    const response = await putPricing(STRIPE_MINIMUM_CENTS);

    expect(response.statusCode).toBe(200);
  });
});
