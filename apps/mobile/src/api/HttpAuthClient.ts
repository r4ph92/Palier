import type { CurrentDriver } from '@palier/shared-types';
import type { AuthClient } from './AuthClient';
import { AuthRequester, type AuthRequesterOptions } from './AuthRequester';
import { parseCurrentDriver } from './parseDriverResponses';

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
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
