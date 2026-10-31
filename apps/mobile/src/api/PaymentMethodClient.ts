import type { SavedCard } from '@palier/shared-types';

export interface PaymentMethodClient {
  fetchCard(): Promise<SavedCard | null>;
  createSetupIntent(): Promise<string>;
  saveCard(paymentMethodId: string): Promise<SavedCard>;
}
