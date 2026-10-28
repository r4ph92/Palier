import { createHash, randomBytes } from 'node:crypto';
import type { Driver } from './Driver.ts';
import type { DriverRepository } from './DriverRepository.ts';

const TOKEN_BYTES = 32;

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
  return { token, driver };
}

export function authenticateDriver(repository: DriverRepository, token: string): Promise<Driver | null> {
  return repository.findDriverBySessionToken(hashSessionToken(token));
}

export function signOutDriver(repository: DriverRepository, token: string): Promise<void> {
  return repository.revokeSessionToken(hashSessionToken(token));
}
