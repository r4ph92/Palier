import { and, desc, eq, gt, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import type {
  NewSessionToken,
  SessionScope,
  SessionTokenRepository,
  SessionUser,
} from '../../domain/sessions/SessionTokenRepository.ts';
import type { Database } from './database.ts';
import { appUser, userSessionToken } from './schema.ts';

// Arbitrary key for the advisory lock, so that only one server purges tokens at a time.
export const SESSION_TOKEN_PURGE_LOCK = 84;

function activeSessionTokensOf(userId: string, scope: SessionScope) {
  return and(
    eq(userSessionToken.userId, userId),
    eq(userSessionToken.scope, scope),
    isNull(userSessionToken.revokedAt),
    gt(userSessionToken.expiresAt, sql`now()`),
  );
}

export class PostgresSessionTokenRepository implements SessionTokenRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async saveSessionToken({ userId, tokenHash, scope, expiresAt }: NewSessionToken): Promise<void> {
    await this.#database.insert(userSessionToken).values({ tokenHash, userId, scope, expiresAt });
  }

  async findUserBySessionToken(tokenHash: string, scope: SessionScope): Promise<SessionUser | null> {
    const [user] = await this.#database
      .select({ id: appUser.id, firstName: appUser.firstName, lastName: appUser.lastName })
      .from(userSessionToken)
      .innerJoin(appUser, eq(appUser.id, userSessionToken.userId))
      .where(
        and(
          eq(userSessionToken.tokenHash, tokenHash),
          eq(userSessionToken.scope, scope),
          isNull(userSessionToken.revokedAt),
          gt(userSessionToken.expiresAt, sql`now()`),
        ),
      )
      .limit(1);
    return user ?? null;
  }

  async revokeSessionToken(tokenHash: string, scope: SessionScope): Promise<void> {
    await this.#database
      .update(userSessionToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessionToken.tokenHash, tokenHash), eq(userSessionToken.scope, scope), isNull(userSessionToken.revokedAt)));
  }

  async revokeOldestSessionTokens(userId: string, scope: SessionScope, keep: number): Promise<void> {
    const activeNewest = this.#database
      .select({ tokenHash: userSessionToken.tokenHash })
      .from(userSessionToken)
      .where(activeSessionTokensOf(userId, scope))
      .orderBy(desc(userSessionToken.createdAt))
      .limit(keep);
    await this.#database
      .update(userSessionToken)
      .set({ revokedAt: new Date() })
      .where(and(activeSessionTokensOf(userId, scope), notInArray(userSessionToken.tokenHash, activeNewest)));
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
}
