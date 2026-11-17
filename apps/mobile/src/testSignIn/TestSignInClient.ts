import type { SignInResponse, TestDriverListResponse } from '@palier/shared-types';

export interface TestSignInClient {
  listTestDrivers(): Promise<TestDriverListResponse>;
  signInAsTestDriver(driverId: string): Promise<SignInResponse>;
}
