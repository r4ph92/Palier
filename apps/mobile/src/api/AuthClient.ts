import type { CurrentDriver, SignInResponse, TestDriverListResponse } from '@palier/shared-types';

export interface AuthClient {
  listTestDrivers(): Promise<TestDriverListResponse>;
  signInAsTestDriver(driverId: string): Promise<SignInResponse>;
  fetchMe(token: string): Promise<CurrentDriver>;
  acceptNotice(token: string, noticeVersion: string): Promise<void>;
  signOut(token: string): Promise<void>;
}

export class PalierUnauthorizedError extends Error {
  constructor() {
    super('Palier refused the session token');
    this.name = 'PalierUnauthorizedError';
  }
}
