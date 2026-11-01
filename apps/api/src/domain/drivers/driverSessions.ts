import { createHash, randomBytes } from 'node:crypto';
import type { Driver } from './Driver.ts';
import type { DriverRepository } from './DriverRepository.ts';

const TOKEN_BYTES = 32;
const MAX_ACTIVE_TOKENS_PER_DRIVER = 10;
const PURGE_RETENTION_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

export interface SignedInDriver {
  readonly token: string;
  readonly driver: Driver;
}

// Only the hash is stored, so a leaked database does not hand out working tokens.
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function signInDriver(repository: DriverRepository, driverId: string): Promise<SignedInDriver | null> {
  const driver = await repository.findDriver(driverId);
  if (driver === null) {
    return null;
  }
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  await repository.saveSessionToken(driver.id, hashSessionToken(token));
  // Signing in again past the limit ends the oldest session, so a leaked old token stops working.
  await repository.revokeOldestSessionTokens(driver.id, MAX_ACTIVE_TOKENS_PER_DRIVER);
  return { token, driver };
}

export function authenticateDriver(repository: DriverRepository, token: string): Promise<Driver | null> {
  return repository.findDriverBySessionToken(hashSessionToken(token));
}

// Tokens that ended more than seven days ago are no longer needed for any check.
export function purgeEndedSessionTokens(repository: DriverRepository, now: Date): Promise<number> {
  return repository.purgeEndedSessionTokens(new Date(now.getTime() - PURGE_RETENTION_MILLISECONDS));
}

export function signOutDriver(repository: DriverRepository, token: string): Promise<void> {
  return repository.revokeSessionToken(hashSessionToken(token));
}
