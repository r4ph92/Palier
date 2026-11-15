import type { PaymentAuthorizer } from '../entries/PaymentAuthorizer.ts';
import type { Clock } from '../time/Clock.ts';
import { settleSurplus, type SurplusSettlement } from './settleSurplus.ts';

export interface PaymentToTake {
  readonly sessionId: string;
  readonly paymentIntentId: string;
  // On the entry hold.
  readonly amountCents: number;
  // Beyond the hold, for a stay over 24 hours; 0 when the hold covers it (decision 027).
  readonly surplusCents: number;
}

export interface SettledPayment extends SurplusSettlement {
  // What Stripe really took on the hold: a repeated capture answers the first one's amount.
  readonly capturedCents: number;
  // When Stripe confirmed the capture, on the exit's clock.
  readonly capturedAt: Date;
}

// capture-failed: Stripe could not take the capture, so the surplus was not asked either; surplus-unknown: the capture went through but
// Stripe could not say whether the card paid the surplus. Both leave the payment to the retry.
export type PaymentTaking = { readonly outcome: 'paid'; readonly payment: SettledPayment } | { readonly outcome: 'capture-failed' | 'surplus-unknown' };

// The capture on the hold, then the surplus: the order of the exit tap and of the retry alike.
export async function takePayment(payments: PaymentAuthorizer, clock: Clock, { sessionId, paymentIntentId, amountCents, surplusCents }: PaymentToTake): Promise<PaymentTaking> {
  const captured = await payments.capture({ sessionId, paymentIntentId, amountCents });
  if (captured.outcome === 'failed') {
    return { outcome: 'capture-failed' };
  }
  const capturedAt = clock();
  const surplus = await settleSurplus(payments, { sessionId, paymentIntentId, amountCents: surplusCents });
  if (surplus === null) {
    return { outcome: 'surplus-unknown' };
  }
  return { outcome: 'paid', payment: { capturedCents: captured.amountCents, capturedAt, ...surplus } };
}
