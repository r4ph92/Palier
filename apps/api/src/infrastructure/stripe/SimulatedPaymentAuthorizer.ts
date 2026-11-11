import type {
  AuthorizationRequest,
  CaptureOutcome,
  CaptureRequest,
  HoldRelease,
  PaymentAuthorizer,
  SurplusOutcome,
  SurplusRequest,
} from '../../domain/entries/PaymentAuthorizer.ts';

const SIMULATED_INTENT_PREFIX = 'pi_sim_';

// The intent id derives from the session, so a retry gets the same intent, as Stripe's idempotency key entry-<sessionId> would.
export class SimulatedPaymentAuthorizer implements PaymentAuthorizer {
  readonly #capturesFail: boolean;

  readonly #surplusFails: boolean;

  // capturesFail: holds work but Stripe is "unreachable" for captures and surplus charges, the outage of a driver leaving (#50).
  // surplusFails: the card refuses what a stay over 24 hours costs beyond the hold (#51).
  constructor({ capturesFail = false, surplusFails = false }: { readonly capturesFail?: boolean; readonly surplusFails?: boolean } = {}) {
    this.#capturesFail = capturesFail;
    this.#surplusFails = surplusFails;
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

  // The simulation moves no money; like Stripe, it refuses an amount that is not positive. An outage of captures is one of the surplus too.
  chargeSurplus({ amountCents }: SurplusRequest): Promise<SurplusOutcome> {
    if (this.#capturesFail) {
      return Promise.resolve({ outcome: 'failed' });
    }
    return Promise.resolve(this.#surplusFails || amountCents <= 0 ? { outcome: 'declined' } : { outcome: 'charged', amountCents });
  }
}
