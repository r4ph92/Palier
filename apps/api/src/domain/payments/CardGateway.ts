import type { SavedCard } from '@palier/shared-types';
import type { Driver } from '../drivers/Driver.ts';

export interface CardPaymentMethod extends SavedCard {
  readonly customerId: string | null;
}

// The part of Stripe the card routes use. Card numbers never reach Palier: the app sends only the payment method id.
export interface CardGateway {
  createCustomer(driver: Driver): Promise<string>;
  createSetupIntentClientSecret(customerId: string): Promise<string>;
  findCardPaymentMethod(paymentMethodId: string): Promise<CardPaymentMethod | null>;
}
