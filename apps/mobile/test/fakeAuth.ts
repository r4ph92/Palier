import type { CurrentDriver, DriverProfile, SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { PalierUnauthorizedError, type AppleIdentity, type AuthClient } from '../src/api/AuthClient';
import type { ProviderSignIn } from '../src/auth/ProviderSignIn';
import { PalierUnreachableError } from '../src/api/LotsClient';
import type { TokenStore } from '../src/auth/TokenStore';
import type { TestSignInClient } from '../src/testSignIn/TestSignInClient';

export const julie: DriverProfile = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie' };
export const testDrivers: TestDriverListResponse = [
  { ...julie, lastName: 'Tremblay' },
  { id: '00000000-0000-4000-8000-000000000502', firstName: 'Marc', lastName: 'Gagnon' },
];

export class FakeAuthClient implements AuthClient {
  validTokens = new Set<string>();
  isReachable = true;
  acceptIsReachable = true;
  acceptedNoticeVersion: string | null = PRIVACY_NOTICE_VERSION;
  acceptedNotices: string[] = [];
  signedOutTokens: string[] = [];
  firstName = julie.firstName;
  // Identity tokens the API trusts, each opening the account with this Palier token.
  trustedIdentityTokens = new Map<string, string>();
  appleNames: { firstName: string | null; lastName: string | null }[] = [];
  savedNames: { firstName: string; lastName: string }[] = [];
  saveNameIsReachable = true;

  fetchMe(token: string): Promise<CurrentDriver> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    const driver = { ...julie, firstName: this.firstName, acceptedNoticeVersion: this.acceptedNoticeVersion };
    return this.validTokens.has(token) ? Promise.resolve(driver) : Promise.reject(new PalierUnauthorizedError());
  }

  signInWithApple({ identityToken, firstName, lastName }: AppleIdentity): Promise<string> {
    this.appleNames.push({ firstName, lastName });
    return this.#signInWith(identityToken);
  }

  signInWithGoogle(identityToken: string): Promise<string> {
    return this.#signInWith(identityToken);
  }

  saveName(token: string, firstName: string, lastName: string): Promise<void> {
    if (!this.saveNameIsReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    if (!this.validTokens.has(token)) {
      return Promise.reject(new PalierUnauthorizedError());
    }
    this.savedNames.push({ firstName, lastName });
    this.firstName = firstName;
    return Promise.resolve();
  }

  #signInWith(identityToken: string): Promise<string> {
    const token = this.trustedIdentityTokens.get(identityToken);
    if (token === undefined) {
      return Promise.reject(new PalierUnauthorizedError());
    }
    this.validTokens.add(token);
    return Promise.resolve(token);
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

export class FakeTestSignInClient implements TestSignInClient {
  driversListIsReachable = true;
  readonly #authClient: FakeAuthClient;

  constructor(authClient: FakeAuthClient) {
    this.#authClient = authClient;
  }

  listTestDrivers(): Promise<TestDriverListResponse> {
    return this.driversListIsReachable ? Promise.resolve(testDrivers) : Promise.reject(new PalierUnreachableError('fake'));
  }

  signInAsTestDriver(driverId: string): Promise<SignInResponse> {
    const token = `${driverId}-token`;
    this.#authClient.validTokens.add(token);
    return Promise.resolve({ token, driver: julie });
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

// Stands for the Apple and Google sheets: each answers what a test sets, null when the person closes it.
export class FakeProviderSignIn implements ProviderSignIn {
  appleIdentity: AppleIdentity | null = { identityToken: 'apple-identity', firstName: null, lastName: null };
  googleIdentityToken: string | null = 'google-identity';
  sheetFails = false;

  apple(): Promise<AppleIdentity | null> {
    return this.sheetFails ? Promise.reject(new Error('sheet failed')) : Promise.resolve(this.appleIdentity);
  }

  google(): Promise<string | null> {
    return this.sheetFails ? Promise.reject(new Error('sheet failed')) : Promise.resolve(this.googleIdentityToken);
  }
}
