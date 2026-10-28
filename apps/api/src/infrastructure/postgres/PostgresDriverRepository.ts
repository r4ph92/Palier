import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Driver } from '../../domain/drivers/Driver.ts';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { Database } from './database.ts';
import { appUser, userConsent, userSessionToken } from './schema.ts';

const driverColumns = { id: appUser.id, firstName: appUser.firstName, lastName: appUser.lastName };

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
      .where(and(eq(userSessionToken.tokenHash, tokenHash), isNull(userSessionToken.revokedAt)))
      .limit(1);
    return driver ?? null;
  }

  async revokeSessionToken(tokenHash: string): Promise<void> {
    await this.#database
      .update(userSessionToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessionToken.tokenHash, tokenHash), isNull(userSessionToken.revokedAt)));
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
}
