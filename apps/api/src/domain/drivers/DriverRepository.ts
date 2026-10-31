import type { SavedCard } from '@palier/shared-types';
import type { Driver } from './Driver.ts';

export interface DriverRepository {
  listDrivers(): Promise<readonly Driver[]>;
  findDriver(driverId: string): Promise<Driver | null>;
  saveSessionToken(driverId: string, tokenHash: string): Promise<void>;
  findDriverBySessionToken(tokenHash: string): Promise<Driver | null>;
  revokeSessionToken(tokenHash: string): Promise<void>;
  findLatestNoticeVersion(driverId: string): Promise<string | null>;
  saveNoticeAcceptance(driverId: string, noticeVersion: string): Promise<void>;
  findStripeCustomerId(driverId: string): Promise<string | null>;
  // Stores the customer only if the driver has none yet, and returns the customer that is stored after the call.
  saveStripeCustomerIdIfMissing(driverId: string, stripeCustomerId: string): Promise<string>;
  findSavedCard(driverId: string): Promise<SavedCard | null>;
  findDefaultPaymentMethodId(driverId: string): Promise<string | null>;
  saveSavedCard(driverId: string, paymentMethodId: string, card: SavedCard): Promise<void>;
}
