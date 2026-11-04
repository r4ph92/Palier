import type {
  NewSessionToken,
  SessionScope,
  SessionTokenRepository,
  SessionUser,
} from '../../../src/domain/sessions/SessionTokenRepository.ts';

interface StoredToken {
  readonly userId: string;
  readonly scope: SessionScope;
  readonly expiresAt: Date;
  revokedAt: Date | null;
}

function isActive(token: StoredToken, now: Date): boolean {
  return token.revokedAt === null && token.expiresAt > now;
}

// Mirrors the Postgres repository: every lookup and the per-user cap are limited to one scope.
export class FakeSessionTokenRepository implements SessionTokenRepository {
  readonly #users: readonly SessionUser[];
  readonly #tokens = new Map<string, StoredToken>();

  constructor(users: readonly SessionUser[]) {
    this.#users = users;
  }

  get activeTokenHashes(): readonly string[] {
    const now = new Date();
    return [...this.#tokens].filter(([, token]) => isActive(token, now)).map(([tokenHash]) => tokenHash);
  }

  saveSessionToken({ userId, tokenHash, scope, expiresAt }: NewSessionToken): Promise<void> {
    this.#tokens.set(tokenHash, { userId, scope, expiresAt, revokedAt: null });
    return Promise.resolve();
  }

  findUserBySessionToken(tokenHash: string, scope: SessionScope): Promise<SessionUser | null> {
    const token = this.#tokens.get(tokenHash);
    if (token === undefined || token.scope !== scope || !isActive(token, new Date())) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.#users.find((user) => user.id === token.userId) ?? null);
  }

  revokeSessionToken(tokenHash: string, scope: SessionScope): Promise<void> {
    const token = this.#tokens.get(tokenHash);
    if (token !== undefined && token.scope === scope && token.revokedAt === null) {
      token.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  revokeOldestSessionTokens(userId: string, scope: SessionScope, keep: number): Promise<void> {
    // Map keeps insertion order, so the first entries of a user are its oldest tokens.
    const now = new Date();
    const userTokens = [...this.#tokens.values()].filter((token) => token.userId === userId && token.scope === scope && isActive(token, now));
    for (const token of userTokens.slice(0, Math.max(0, userTokens.length - keep))) {
      token.revokedAt = now;
    }
    return Promise.resolve();
  }

  purgeEndedSessionTokens(endedBefore: Date): Promise<number> {
    let purged = 0;
    for (const [tokenHash, token] of this.#tokens) {
      const revokedBefore = token.revokedAt !== null && token.revokedAt < endedBefore;
      if (token.expiresAt < endedBefore || revokedBefore) {
        this.#tokens.delete(tokenHash);
        purged += 1;
      }
    }
    return Promise.resolve(purged);
  }
}
