import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { SavedCard } from '@palier/shared-types';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { Database } from './database.ts';
import { appUser, userConsent } from './schema.ts';

export class PostgresDriverRepository implements DriverRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findLatestNoticeVersion(driverId: string): Promise<string | null> {
    const [consent] = await this.#database
      .select({ noticeVersion: userConsent.noticeVersion })
      .from(userConsent)
      .where(eq(userConsent.userId, driverId))
      .orderBy(desc(userConsent.acceptedAt))
      .limit(1);
    return consent?.noticeVersion ?? null;
  }

  async hasLatestNoticeVersion(driverId: string, noticeVersion: string): Promise<boolean> {
    return (await this.findLatestNoticeVersion(driverId)) === noticeVersion;
  }

  // Accepting an older version again makes it the latest, so the guard and /v1/me see the rollback.
  async saveNoticeAcceptance(driverId: string, noticeVersion: string): Promise<void> {
    await this.#database
      .insert(userConsent)
      .values({ userId: driverId, noticeVersion })
      .onConflictDoUpdate({
        target: [userConsent.userId, userConsent.noticeVersion],
        set: { acceptedAt: sql`now()` },
      });
  }

  async findStripeCustomerId(driverId: string): Promise<string | null> {
    const [driver] = await this.#database
      .select({ stripeCustomerId: appUser.stripeCustomerId })
      .from(appUser)
      .where(eq(appUser.id, driverId))
      .limit(1);
    return driver?.stripeCustomerId ?? null;
  }

  // One conditional UPDATE, so two concurrent setup intents for the same driver end up with one customer.
  async saveStripeCustomerIdIfMissing(driverId: string, stripeCustomerId: string): Promise<string> {
    await this.#database
      .update(appUser)
      .set({ stripeCustomerId })
      .where(and(eq(appUser.id, driverId), isNull(appUser.stripeCustomerId)));
    return (await this.findStripeCustomerId(driverId)) ?? stripeCustomerId;
  }

  async findSavedCard(driverId: string): Promise<SavedCard | null> {
    const [driver] = await this.#database
      .select({ brand: appUser.cardBrand, last4: appUser.cardLast4 })
      .from(appUser)
      .where(eq(appUser.id, driverId))
      .limit(1);
    return driver?.brand && driver.last4 ? { brand: driver.brand, last4: driver.last4 } : null;
  }

  async findDefaultPaymentMethodId(driverId: string): Promise<string | null> {
    const [driver] = await this.#database
      .select({ defaultPmId: appUser.defaultPmId })
      .from(appUser)
      .where(eq(appUser.id, driverId))
      .limit(1);
    return driver?.defaultPmId ?? null;
  }

  async saveSavedCard(driverId: string, paymentMethodId: string, card: SavedCard): Promise<void> {
    await this.#database
      .update(appUser)
      .set({ defaultPmId: paymentMethodId, cardBrand: card.brand, cardLast4: card.last4 })
      .where(eq(appUser.id, driverId));
  }
}
