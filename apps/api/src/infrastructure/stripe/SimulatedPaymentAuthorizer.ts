import type { AuthorizationRequest, CaptureOutcome, CaptureRequest, HoldRelease, PaymentAuthorizer } from '../../domain/entries/PaymentAuthorizer.ts';

const SIMULATED_INTENT_PREFIX = 'pi_sim_';

// The intent id derives from the session, so a retry gets the same intent, as Stripe's idempotency key entry-<sessionId> would.
export class SimulatedPaymentAuthorizer implements PaymentAuthorizer {
  readonly #capturesFail: boolean;

  // capturesFail: holds work but Stripe is "unreachable" for captures, the outage of a driver leaving (#50).
  constructor({ capturesFail = false }: { readonly capturesFail?: boolean } = {}) {
    this.#capturesFail = capturesFail;
  }

  authorize({ sessionId }: AuthorizationRequest): Promise<string> {
    return Promise.resolve(`${SIMULATED_INTENT_PREFIX}${sessionId}`);
  }

  // A real intent left from an earlier run with a key is not this simulation's to release.
  cancel(paymentIntentId: string): Promise<HoldRelease> {
    return Promise.resolve(paymentIntentId.startsWith(SIMULATED_INTENT_PREFIX) ? 'released' : 'gone');
  }

  capture({ amountCents }: CaptureRequest): Promise<CaptureOutcome> {
    return Promise.resolve(this.#capturesFail ? { outcome: 'failed' } : { outcome: 'captured', amountCents });
  }
}
