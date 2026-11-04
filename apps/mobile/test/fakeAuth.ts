import type { CurrentDriver, DriverProfile, SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
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
  acceptIsReachable = true;
  acceptedNoticeVersion: string | null = PRIVACY_NOTICE_VERSION;
  acceptedNotices: string[] = [];
  signedOutTokens: string[] = [];

  listTestDrivers(): Promise<TestDriverListResponse> {
    return this.driversListIsReachable ? Promise.resolve(testDrivers) : Promise.reject(new PalierUnreachableError('fake'));
  }

  signInAsTestDriver(driverId: string): Promise<SignInResponse> {
    const token = `${driverId}-token`;
    this.validTokens.add(token);
    return Promise.resolve({ token, driver: julie });
  }

  fetchMe(token: string): Promise<CurrentDriver> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    const driver = { ...julie, acceptedNoticeVersion: this.acceptedNoticeVersion };
    return this.validTokens.has(token) ? Promise.resolve(driver) : Promise.reject(new PalierUnauthorizedError());
  }

  acceptNotice(token: string, noticeVersion: string): Promise<void> {
    if (!this.acceptIsReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    if (!this.validTokens.has(token)) {
      return Promise.reject(new PalierUnauthorizedError());
    }
    this.acceptedNotices.push(noticeVersion);
    this.acceptedNoticeVersion = noticeVersion;
    return Promise.resolve();
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
