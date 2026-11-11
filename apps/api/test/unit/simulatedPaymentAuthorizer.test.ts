import { describe, expect, it } from 'vitest';
import { SimulatedPaymentAuthorizer } from '../../src/infrastructure/stripe/SimulatedPaymentAuthorizer.ts';

const request = { sessionId: 'session-1', customerId: 'cus_sim_01', paymentMethodId: 'pm_sim_01', amountCents: 2500, destinationAccountId: null };

describe('SimulatedPaymentAuthorizer', () => {
  it('answers one simulated intent per session, the same on a retry', async () => {
    const payments = new SimulatedPaymentAuthorizer();

    expect(await payments.authorize(request)).toBe('pi_sim_session-1');
    expect(await payments.authorize(request)).toBe('pi_sim_session-1');
  });

  it('charges a surplus unless the simulation declines it', async () => {
    const surplus = { sessionId: 'session-1', paymentIntentId: 'pi_sim_session-1', amountCents: 1800 };

    expect(await new SimulatedPaymentAuthorizer().chargeSurplus(surplus)).toEqual({ outcome: 'charged', amountCents: 1800 });
    expect(await new SimulatedPaymentAuthorizer({ surplusFails: true }).chargeSurplus(surplus)).toEqual({ outcome: 'declined' });
  });

  it('fails the surplus like the capture when the simulation makes Stripe unreachable for captures', async () => {
    const surplus = { sessionId: 'session-1', paymentIntentId: 'pi_sim_session-1', amountCents: 1800 };

    expect(await new SimulatedPaymentAuthorizer({ capturesFail: true }).chargeSurplus(surplus)).toEqual({ outcome: 'failed' });
  });

  it('releases a simulated hold', async () => {
    expect(await new SimulatedPaymentAuthorizer().cancel('pi_sim_session-1')).toBe('released');
  });

  it('answers gone for a real intent, so the job never retries a hold it cannot reach', async () => {
    expect(await new SimulatedPaymentAuthorizer().cancel('pi_3Q0realIntent')).toBe('gone');
  });
});
