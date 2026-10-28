import type { DriverProfile, SignInResponse, TestDriverListResponse } from '@palier/shared-types';

export interface AuthClient {
  listTestDrivers(): Promise<TestDriverListResponse>;
  signInAsTestDriver(driverId: string): Promise<SignInResponse>;
  fetchMe(token: string): Promise<DriverProfile>;
  signOut(token: string): Promise<void>;
}

export class PalierUnauthorizedError extends Error {
  constructor() {
    super('Palier refused the session token');
    this.name = 'PalierUnauthorizedError';
  }
}
