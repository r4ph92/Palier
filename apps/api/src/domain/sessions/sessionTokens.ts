import { createHash, randomBytes } from 'node:crypto';
import type { SessionScope, SessionTokenRepository, SessionUser } from './SessionTokenRepository.ts';
import type { UserDirectory } from './UserDirectory.ts';

const TOKEN_BYTES = 32;
const MAX_ACTIVE_TOKENS_PER_SCOPE = 10;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const PURGE_RETENTION_MILLISECONDS = 7 * 24 * HOUR_MILLISECONDS;
// The dashboard handles an operator's money settings, so its sessions are much shorter than the app's.
const TOKEN_LIFETIME_MILLISECONDS: Readonly<Record<SessionScope, number>> = {
  APP: 30 * 24 * HOUR_MILLISECONDS,
  DASHBOARD: 12 * HOUR_MILLISECONDS,
};

export interface SessionAccess {
  readonly users: UserDirectory;
  readonly sessions: SessionTokenRepository;
}

export interface SignedInUser {
  readonly token: string;
  readonly user: SessionUser;
}

// Only the hash is stored, so a leaked database does not hand out working tokens.
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionLifetimeSeconds(scope: SessionScope): number {
  return TOKEN_LIFETIME_MILLISECONDS[scope] / 1000;
}

export async function signInUser({ users, sessions }: SessionAccess, userId: string, scope: SessionScope): Promise<SignedInUser | null> {
  const user = await users.findUser(userId);
  if (user === null) {
    return null;
  }
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MILLISECONDS[scope]);
  await sessions.saveSessionToken({ userId: user.id, tokenHash: hashSessionToken(token), scope, expiresAt });
  // Signing in again past the limit ends the oldest session of that scope, so a leaked old token stops working.
  await sessions.revokeOldestSessionTokens(user.id, scope, MAX_ACTIVE_TOKENS_PER_SCOPE);
  return { token, user };
}

export function authenticateSessionToken(sessions: SessionTokenRepository, token: string, scope: SessionScope): Promise<SessionUser | null> {
  return sessions.findUserBySessionToken(hashSessionToken(token), scope);
}

export function revokeSession(sessions: SessionTokenRepository, token: string, scope: SessionScope): Promise<void> {
  return sessions.revokeSessionToken(hashSessionToken(token), scope);
}

// Tokens that ended more than seven days ago are no longer needed for any check.
export function purgeEndedSessionTokens(sessions: SessionTokenRepository, now: Date): Promise<number> {
  return sessions.purgeEndedSessionTokens(new Date(now.getTime() - PURGE_RETENTION_MILLISECONDS));
}
