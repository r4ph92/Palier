import type { SavedCard } from '@palier/shared-types';
import { PalierUnreachableError } from '../src/api/LotsClient';
import type { PaymentMethodClient } from '../src/api/PaymentMethodClient';

export class FakePaymentMethodClient implements PaymentMethodClient {
  card: SavedCard | null;
  isReachable = true;
  declinesCard = false;
  readonly savedPaymentMethodIds: string[] = [];

  constructor(card: SavedCard | null = null) {
    this.card = card;
  }

  fetchCard(): Promise<SavedCard | null> {
    return this.isReachable ? Promise.resolve(this.card) : Promise.reject(new PalierUnreachableError('fake'));
  }

  createSetupIntent(): Promise<string> {
    return Promise.resolve('seti_secret_fake');
  }

  saveCard(paymentMethodId: string): Promise<SavedCard> {
    this.savedPaymentMethodIds.push(paymentMethodId);
    this.card = { brand: 'mastercard', last4: '4444' };
    return Promise.resolve(this.card);
  }
}
