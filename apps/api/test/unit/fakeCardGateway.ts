import type { SavedCard } from '@palier/shared-types';
import type { Driver } from '../../src/domain/drivers/Driver.ts';
import type { CardGateway, CardPaymentMethod } from '../../src/domain/payments/CardGateway.ts';

export class FakeCardGateway implements CardGateway {
  readonly #paymentMethods = new Map<string, CardPaymentMethod>();
  readonly createdCustomerDriverIds: string[] = [];

  createCustomer(driver: Driver): Promise<string> {
    this.createdCustomerDriverIds.push(driver.id);
    return Promise.resolve(`cus_${this.createdCustomerDriverIds.length}`);
  }

  createSetupIntentClientSecret(customerId: string): Promise<string> {
    return Promise.resolve(`seti_secret_${customerId}`);
  }

  findCardPaymentMethod(paymentMethodId: string): Promise<CardPaymentMethod | null> {
    return Promise.resolve(this.#paymentMethods.get(paymentMethodId) ?? null);
  }

  readonly detachedPaymentMethodIds: string[] = [];

  detachPaymentMethod(paymentMethodId: string): Promise<void> {
    this.detachedPaymentMethodIds.push(paymentMethodId);
    return Promise.resolve();
  }

  // Stands in for Stripe attaching a card to a customer when the app confirms its setup.
  attachCard(paymentMethodId: string, customerId: string, card: SavedCard): void {
    this.#paymentMethods.set(paymentMethodId, { customerId, ...card });
  }
}
