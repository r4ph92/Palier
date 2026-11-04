import { eq, inArray } from 'drizzle-orm';
import type { SessionUser } from '../../domain/sessions/SessionTokenRepository.ts';
import type { UserDirectory } from '../../domain/sessions/UserDirectory.ts';
import type { Database } from './database.ts';
import { appUser } from './schema.ts';

const userColumns = { id: appUser.id, firstName: appUser.firstName, lastName: appUser.lastName };

export class PostgresUserDirectory implements UserDirectory {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findUser(userId: string): Promise<SessionUser | null> {
    const [user] = await this.#database.select(userColumns).from(appUser).where(eq(appUser.id, userId)).limit(1);
    return user ?? null;
  }

  async findUsers(userIds: readonly string[]): Promise<readonly SessionUser[]> {
    if (userIds.length === 0) {
      return [];
    }
    const users = await this.#database.select(userColumns).from(appUser).where(inArray(appUser.id, [...userIds]));
    const usersById = new Map(users.map((user) => [user.id, user]));
    return userIds.flatMap((userId) => usersById.get(userId) ?? []);
  }
}
