import type { DriverProfile, SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import { PalierUnauthorizedError, type AuthClient } from '../src/api/AuthClient';
import { PalierUnreachableError } from '../src/api/LotsClient';
import type { TokenStore } from '../src/auth/TokenStore';

export const julie: DriverProfile = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie' };
export const testDrivers: TestDriverListResponse = [
  { ...julie, lastName: 'Tremblay' },
  { id: '00000000-0000-4000-8000-000000000502', firstName: 'Marc', lastName: 'Gagnon' },
];

export class FakeAuthClient implements AuthClient {
  validTokens = new Set<string>();
  isReachable = true;
  driversListIsReachable = true;
  signedOutTokens: string[] = [];

  listTestDrivers(): Promise<TestDriverListResponse> {
    return this.driversListIsReachable ? Promise.resolve(testDrivers) : Promise.reject(new PalierUnreachableError('fake'));
  }

  signInAsTestDriver(driverId: string): Promise<SignInResponse> {
    const token = `${driverId}-token`;
    this.validTokens.add(token);
    return Promise.resolve({ token, driver: julie });
  }

  fetchMe(token: string): Promise<DriverProfile> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    return this.validTokens.has(token) ? Promise.resolve(julie) : Promise.reject(new PalierUnauthorizedError());
  }

  signOut(token: string): Promise<void> {
    this.signedOutTokens.push(token);
    this.validTokens.delete(token);
    return Promise.resolve();
  }
}

export class MemoryTokenStore implements TokenStore {
  token: string | null;

  constructor(token: string | null = null) {
    this.token = token;
  }

  read(): Promise<string | null> {
    return Promise.resolve(this.token);
  }

  save(token: string): Promise<void> {
    this.token = token;
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.token = null;
    return Promise.resolve();
  }
}
