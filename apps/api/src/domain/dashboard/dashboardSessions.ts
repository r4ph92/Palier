import type { SessionTokenRepository, SessionUser } from '../sessions/SessionTokenRepository.ts';
import { authenticateSessionToken, revokeSession, signInUser, type SessionAccess, type SignedInUser } from '../sessions/sessionTokens.ts';

export function signInDashboardUser(access: SessionAccess, userId: string): Promise<SignedInUser | null> {
  return signInUser(access, userId, 'DASHBOARD');
}

export function authenticateDashboardUser(sessions: SessionTokenRepository, token: string): Promise<SessionUser | null> {
  return authenticateSessionToken(sessions, token, 'DASHBOARD');
}

export function signOutDashboardUser(sessions: SessionTokenRepository, token: string): Promise<void> {
  return revokeSession(sessions, token, 'DASHBOARD');
}
