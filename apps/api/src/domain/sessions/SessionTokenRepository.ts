export type SessionScope = 'APP' | 'DASHBOARD';

export interface SessionUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface NewSessionToken {
  readonly userId: string;
  readonly tokenHash: string;
  readonly scope: SessionScope;
  readonly expiresAt: Date;
}

// Every lookup names its scope, so a token issued for one surface is never accepted by the other.
export interface SessionTokenRepository {
  saveSessionToken(token: NewSessionToken): Promise<void>;
  findUserBySessionToken(tokenHash: string, scope: SessionScope): Promise<SessionUser | null>;
  revokeSessionToken(tokenHash: string, scope: SessionScope): Promise<void>;
  // Revokes every active token of the user in that scope except the keep newest ones.
  revokeOldestSessionTokens(userId: string, scope: SessionScope, keep: number): Promise<void>;
  // Deletes the tokens that expired or were revoked before the given time, and returns how many it deleted.
  purgeEndedSessionTokens(endedBefore: Date): Promise<number>;
}
