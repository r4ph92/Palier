export interface AuthorizationRequest {
  readonly sessionId: string;
  readonly customerId: string;
  readonly paymentMethodId: string;
  readonly amountCents: number;
  // Null only in demo mode, when the operator has no connected account: the hold then stays on the platform.
  readonly destinationAccountId: string | null;
}

// released: Stripe holds nothing any more. gone: the intent cannot be cancelled (missing, captured), retrying is pointless.
// failed: Stripe could not be reached or answered an error worth retrying.
export type HoldRelease = 'released' | 'gone' | 'failed';

export interface PaymentAuthorizer {
  // Holds the amount on the card without capturing it and answers the payment intent id.
  // Throws EntryRefusedError CARD_DECLINED or PAYMENTS_UNAVAILABLE.
  authorize(request: AuthorizationRequest): Promise<string>;
  // Never throws for a Stripe error: the outcome says whether to retry. Cancelling twice answers released.
  cancel(paymentIntentId: string): Promise<HoldRelease>;
}
