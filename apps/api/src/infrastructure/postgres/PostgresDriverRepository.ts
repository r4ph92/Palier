import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Driver } from '../../domain/drivers/Driver.ts';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { Database } from './database.ts';
import { appUser, userSessionToken } from './schema.ts';

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
}
