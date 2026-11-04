export interface SavedCard {
  readonly brand: string;
  readonly last4: string;
}

export interface PaymentMethodResponse {
  readonly card: SavedCard | null;
}

export interface SetupIntentResponse {
  readonly clientSecret: string;
}

export interface SavePaymentMethodRequest {
  readonly paymentMethodId: string;
}
