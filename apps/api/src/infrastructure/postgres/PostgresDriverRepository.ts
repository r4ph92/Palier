import { and, asc, desc, eq, gt, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import type { SavedCard } from '@palier/shared-types';
import type { Driver } from '../../domain/drivers/Driver.ts';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { Database } from './database.ts';
import { appUser, userConsent, userSessionToken } from './schema.ts';

const driverColumns = { id: appUser.id, firstName: appUser.firstName, lastName: appUser.lastName };
// Arbitrary key for the advisory lock, so that only one server purges tokens at a time.
const SESSION_TOKEN_PURGE_LOCK = 84;

function activeSessionTokensOf(driverId: string) {
  return and(
    eq(userSessionToken.userId, driverId),
    isNull(userSessionToken.revokedAt),
    gt(userSessionToken.expiresAt, sql`now()`),
  );
}

export class PostgresDriverRepository implements DriverRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  listDrivers(): Promise<readonly Driver[]> {
    return this.#database.select(driverColumns).from(appUser).orderBy(asc(appUser.firstName), asc(appUser.lastName));
  }

  async findDriver(driverId: string): Promise<Driver | null> {
    const [driver] = await this.#database.select(driverColumns).from(appUser).where(eq(appUser.id, driverId)).limit(1);
    return driver ?? null;
  }

  async saveSessionToken(driverId: string, tokenHash: string): Promise<void> {
    await this.#database.insert(userSessionToken).values({ tokenHash, userId: driverId });
  }

  async findDriverBySessionToken(tokenHash: string): Promise<Driver | null> {
    const [driver] = await this.#database
      .select(driverColumns)
      .from(userSessionToken)
      .innerJoin(appUser, eq(appUser.id, userSessionToken.userId))
      .where(
        and(
          eq(userSessionToken.tokenHash, tokenHash),
          isNull(userSessionToken.revokedAt),
          gt(userSessionToken.expiresAt, sql`now()`),
        ),
      )
      .limit(1);
    return driver ?? null;
  }

  async revokeSessionToken(tokenHash: string): Promise<void> {
    await this.#database
      .update(userSessionToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessionToken.tokenHash, tokenHash), isNull(userSessionToken.revokedAt)));
  }

  async revokeOldestSessionTokens(driverId: string, keep: number): Promise<void> {
    const activeNewest = this.#database
      .select({ tokenHash: userSessionToken.tokenHash })
      .from(userSessionToken)
      .where(activeSessionTokensOf(driverId))
      .orderBy(desc(userSessionToken.createdAt))
      .limit(keep);
    await this.#database
      .update(userSessionToken)
      .set({ revokedAt: new Date() })
      .where(and(activeSessionTokensOf(driverId), notInArray(userSessionToken.tokenHash, activeNewest)));
  }

  // Returns 0 without deleting anything when another server holds the purge lock.
  purgeEndedSessionTokens(endedBefore: Date): Promise<number> {
    return this.#database.transaction(async (transaction) => {
      const [lock] = await transaction.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(${SESSION_TOKEN_PURGE_LOCK}) as locked`,
      );
      if (!lock?.locked) {
        return 0;
      }
      const purged = await transaction
        .delete(userSessionToken)
        .where(or(lt(userSessionToken.expiresAt, endedBefore), lt(userSessionToken.revokedAt, endedBefore)))
        .returning({ tokenHash: userSessionToken.tokenHash });
      return purged.length;
    });
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
