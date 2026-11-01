import type { SavedCard } from '@palier/shared-types';
import type { Driver } from './Driver.ts';

export interface DriverRepository {
  listDrivers(): Promise<readonly Driver[]>;
  findDriver(driverId: string): Promise<Driver | null>;
  saveSessionToken(driverId: string, tokenHash: string): Promise<void>;
  findDriverBySessionToken(tokenHash: string): Promise<Driver | null>;
  revokeSessionToken(tokenHash: string): Promise<void>;
  // Revokes every active token of the driver except the keep newest ones.
  revokeOldestSessionTokens(driverId: string, keep: number): Promise<void>;
  // Deletes the tokens that expired or were revoked before the given time, and returns how many it deleted.
  purgeEndedSessionTokens(endedBefore: Date): Promise<number>;
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
