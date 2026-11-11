import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import type { CaptureOutcome, HoldRelease, PaymentAuthorizer, SurplusOutcome } from '../../domain/entries/PaymentAuthorizer.ts';

// The test environment's "Stripe unreachable" switch: every call fails the way a Stripe outage does.
export class UnreachablePaymentAuthorizer implements PaymentAuthorizer {
  authorize(): Promise<string> {
    return Promise.reject(new EntryRefusedError('PAYMENTS_UNAVAILABLE', { cause: new Error('Stripe unreachable (simulated)') }));
  }

  cancel(): Promise<HoldRelease> {
    return Promise.resolve('failed');
  }

  capture(): Promise<CaptureOutcome> {
    return Promise.resolve({ outcome: 'failed' });
  }

  chargeSurplus(): Promise<SurplusOutcome> {
    return Promise.resolve({ outcome: 'failed' });
  }
}
