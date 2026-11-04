import type { Driver } from './Driver.ts';
import type { DriverRepository } from './DriverRepository.ts';
import type { SessionTokenRepository } from '../sessions/SessionTokenRepository.ts';
import { authenticateSessionToken, revokeSession, signInUser } from '../sessions/sessionTokens.ts';

export interface DriverAccess {
  readonly drivers: DriverRepository;
  readonly sessions: SessionTokenRepository;
}

export interface SignedInDriver {
  readonly token: string;
  readonly driver: Driver;
}

export async function signInDriver({ drivers, sessions }: DriverAccess, driverId: string): Promise<SignedInDriver | null> {
  const signedIn = await signInUser({ users: drivers, sessions }, driverId, 'APP');
  return signedIn === null ? null : { token: signedIn.token, driver: signedIn.user };
}

export function authenticateDriver(sessions: SessionTokenRepository, token: string): Promise<Driver | null> {
  return authenticateSessionToken(sessions, token, 'APP');
}

export function signOutDriver(sessions: SessionTokenRepository, token: string): Promise<void> {
  return revokeSession(sessions, token, 'APP');
}
