import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import type { PaymentAuthorizer } from '../../domain/entries/PaymentAuthorizer.ts';

// The test environment's "Stripe unreachable" switch: every call fails the way a Stripe outage does.
export class UnreachablePaymentAuthorizer implements PaymentAuthorizer {
  authorize(): Promise<string> {
    return Promise.reject(new EntryRefusedError('PAYMENTS_UNAVAILABLE', { cause: new Error('Stripe unreachable (simulated)') }));
  }

  cancel(): Promise<void> {
    return Promise.reject(new Error('Stripe unreachable (simulated)'));
  }
}
