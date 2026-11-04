import type { AuthorizationRequest, HoldRelease, PaymentAuthorizer } from '../../domain/entries/PaymentAuthorizer.ts';

const SIMULATED_INTENT_PREFIX = 'pi_sim_';

// The test environment's "payments succeed" switch, for a lane without a Stripe key: no call leaves the server.
// The intent id derives from the session, as Stripe's idempotency key entry-<sessionId> would make a retry answer the same intent.
export class SimulatedPaymentAuthorizer implements PaymentAuthorizer {
  authorize({ sessionId }: AuthorizationRequest): Promise<string> {
    return Promise.resolve(`${SIMULATED_INTENT_PREFIX}${sessionId}`);
  }

  // A real intent left from an earlier run with a key is not this simulation's to release.
  cancel(paymentIntentId: string): Promise<HoldRelease> {
    return Promise.resolve(paymentIntentId.startsWith(SIMULATED_INTENT_PREFIX) ? 'released' : 'gone');
  }
}
