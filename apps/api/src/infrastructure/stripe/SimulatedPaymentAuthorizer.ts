import type { AuthorizationRequest, HoldRelease, PaymentAuthorizer } from '../../domain/entries/PaymentAuthorizer.ts';

const SIMULATED_INTENT_PREFIX = 'pi_sim_';

// The intent id derives from the session, so a retry gets the same intent, as Stripe's idempotency key entry-<sessionId> would.
export class SimulatedPaymentAuthorizer implements PaymentAuthorizer {
  authorize({ sessionId }: AuthorizationRequest): Promise<string> {
    return Promise.resolve(`${SIMULATED_INTENT_PREFIX}${sessionId}`);
  }

  // A real intent left from an earlier run with a key is not this simulation's to release.
  cancel(paymentIntentId: string): Promise<HoldRelease> {
    return Promise.resolve(paymentIntentId.startsWith(SIMULATED_INTENT_PREFIX) ? 'released' : 'gone');
  }
}
