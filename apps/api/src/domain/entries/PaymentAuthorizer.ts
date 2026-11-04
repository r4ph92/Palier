export interface AuthorizationRequest {
  readonly sessionId: string;
  readonly customerId: string;
  readonly paymentMethodId: string;
  readonly amountCents: number;
  // Null only in demo mode, when the operator has no connected account: the hold then stays on the platform.
  readonly destinationAccountId: string | null;
}

export interface PaymentAuthorizer {
  // Holds the amount on the card without capturing it and answers the payment intent id.
  // Throws EntryRefusedError CARD_DECLINED or PAYMENTS_UNAVAILABLE.
  authorize(request: AuthorizationRequest): Promise<string>;
  cancel(paymentIntentId: string): Promise<void>;
}
