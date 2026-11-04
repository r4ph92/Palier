import type { SavedCard } from '@palier/shared-types';

export interface DriverRepository {
  findLatestNoticeVersion(driverId: string): Promise<string | null>;
  // True when the latest notice the driver accepted is the given version, which is the consent rule the guards apply.
  hasLatestNoticeVersion(driverId: string, noticeVersion: string): Promise<boolean>;
  saveNoticeAcceptance(driverId: string, noticeVersion: string): Promise<void>;
  findStripeCustomerId(driverId: string): Promise<string | null>;
  // Stores the customer only if the driver has none yet, and returns the customer that is stored after the call.
  saveStripeCustomerIdIfMissing(driverId: string, stripeCustomerId: string): Promise<string>;
  findSavedCard(driverId: string): Promise<SavedCard | null>;
  findDefaultPaymentMethodId(driverId: string): Promise<string | null>;
  saveSavedCard(driverId: string, paymentMethodId: string, card: SavedCard): Promise<void>;
}
