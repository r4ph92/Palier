import type { CurrentDriver } from '@palier/shared-types';
import type { AppleIdentity, AuthClient } from './AuthClient';
import { AuthRequester, type AuthRequesterOptions } from './AuthRequester';
import { parseCurrentDriver, parseSignInResponse } from './parseDriverResponses';

export type HttpAuthClientOptions = AuthRequesterOptions;

export class HttpAuthClient implements AuthClient {
  readonly #requester: AuthRequester;

  constructor(options: HttpAuthClientOptions) {
    this.#requester = new AuthRequester(options);
  }

  async fetchMe(token: string): Promise<CurrentDriver> {
    const response = await this.#requester.request('/v1/me', { method: 'GET', headers: bearer(token) });
    return parseCurrentDriver(await this.#requester.json(response));
  }

  signInWithApple({ identityToken, firstName, lastName }: AppleIdentity): Promise<string> {
    return this.#signIn('/v1/sign-in/apple', { identityToken, ...(firstName === null ? {} : { firstName }), ...(lastName === null ? {} : { lastName }) });
  }

  signInWithGoogle(identityToken: string): Promise<string> {
    return this.#signIn('/v1/sign-in/google', { identityToken });
  }

  async saveName(token: string, firstName: string, lastName: string): Promise<void> {
    await this.#requester.request('/v1/me/name', {
      method: 'PUT',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName }),
    });
  }

  async acceptNotice(token: string, noticeVersion: string): Promise<void> {
    await this.#requester.request('/v1/consent', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticeVersion }),
    });
  }

  async signOut(token: string): Promise<void> {
    await this.#requester.request('/v1/sign-out', { method: 'POST', headers: bearer(token) });
  }

  async #signIn(path: string, body: object): Promise<string> {
    const response = await this.#requester.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return parseSignInResponse(await this.#requester.json(response)).token;
  }
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
