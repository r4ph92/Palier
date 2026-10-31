import type { SavedCard } from '@palier/shared-types';
import type { Driver } from '../drivers/Driver.ts';

export interface CardPaymentMethod extends SavedCard {
  readonly customerId: string | null;
}

// Stripe's own error text stays in the log; the client only gets this fixed 503.
export class CardProviderUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = 'PAYMENTS_UNAVAILABLE';

  constructor(options?: ErrorOptions) {
    super('Card payments are unavailable right now.', options);
    this.name = 'CardProviderUnavailableError';
  }
}

// The part of Stripe the card routes use. Card numbers never reach Palier: the app sends only the payment method id.
export interface CardGateway {
  createCustomer(driver: Driver): Promise<string>;
  createSetupIntentClientSecret(customerId: string): Promise<string>;
  findCardPaymentMethod(paymentMethodId: string): Promise<CardPaymentMethod | null>;
}
