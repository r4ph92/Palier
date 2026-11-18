import type { SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import { AuthRequester, type AuthRequesterOptions } from '../api/AuthRequester';
import { parseSignInResponse, parseTestDrivers } from './parseTestSignInResponses';
import type { TestSignInClient } from './TestSignInClient';

export class HttpTestSignInClient implements TestSignInClient {
  readonly #requester: AuthRequester;

  constructor(options: AuthRequesterOptions) {
    this.#requester = new AuthRequester(options);
  }

  async listTestDrivers(): Promise<TestDriverListResponse> {
    const response = await this.#requester.request('/v1/test/drivers', { method: 'GET' });
    return parseTestDrivers(await this.#requester.json(response));
  }

  async signInAsTestDriver(driverId: string): Promise<SignInResponse> {
    const response = await this.#requester.request('/v1/test/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId }),
    });
    return parseSignInResponse(await this.#requester.json(response));
  }
}
