export interface AuthorizationRequest {
  readonly sessionId: string;
  readonly customerId: string;
  readonly paymentMethodId: string;
  readonly amountCents: number;
  // Null only in demo mode, when the operator has no connected account: the hold then stays on the platform.
  readonly destinationAccountId: string | null;
}

// released: nothing held any more; gone: missing or captured, never retried; failed: Stripe unreachable or erring, retried.
export type HoldRelease = 'released' | 'gone' | 'failed';

export interface CaptureRequest {
  readonly sessionId: string;
  readonly paymentIntentId: string;
  readonly amountCents: number;
}

// captured: the amount Stripe really took (a repeat answers the first capture's amount, whatever is asked now) and the rest released;
// failed: Stripe unreachable or erring, nothing known to be taken.
export type CaptureOutcome = { readonly outcome: 'captured'; readonly amountCents: number } | { readonly outcome: 'failed' };

export interface SurplusRequest {
  readonly sessionId: string;
  // The entry authorization: the surplus goes to the same card and the same operator account.
  readonly paymentIntentId: string;
  readonly amountCents: number;
}

// charged: the amount is taken from the card; failed: the card refused it or Stripe could not be reached, nothing known to be taken.
export type SurplusOutcome = { readonly outcome: 'charged' | 'failed' };

export interface PaymentAuthorizer {
  // Holds the amount on the card without capturing it and answers the payment intent id.
  // Throws EntryRefusedError CARD_DECLINED or PAYMENTS_UNAVAILABLE.
  authorize(request: AuthorizationRequest): Promise<string>;
  // Never throws for a Stripe error: the outcome says whether to retry. Cancelling twice answers released.
  cancel(paymentIntentId: string): Promise<HoldRelease>;
  // Takes the amount from the hold and releases the rest. Never throws for a Stripe error; the same session captures once.
  capture(request: CaptureRequest): Promise<CaptureOutcome>;
  // Charges the part of a stay beyond the card hold, off session, on the card of the entry authorization. Never throws for a Stripe
  // error; one session charges its surplus once (decision 027).
  chargeSurplus(request: SurplusRequest): Promise<SurplusOutcome>;
}
