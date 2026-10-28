import type { CurrentDriver, SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import { PalierUnauthorizedError, type AuthClient } from './AuthClient';
import { PalierStatusError, PalierUnreachableError } from './LotsClient';
import { parseCurrentDriver, parseSignInResponse, parseTestDrivers } from './parseDriverResponses';

const DEFAULT_TIMEOUT_MILLISECONDS = 8000;
const UNAUTHORIZED = 401;

export interface HttpAuthClientOptions {
  readonly baseUrl: string;
  readonly fetchFunction?: typeof fetch;
  readonly timeoutMilliseconds?: number;
}

export class HttpAuthClient implements AuthClient {
  readonly #baseUrl: string;
  readonly #fetchFunction: typeof fetch;
  readonly #timeoutMilliseconds: number;

  constructor(options: HttpAuthClientOptions) {
    this.#baseUrl = options.baseUrl;
    this.#fetchFunction = options.fetchFunction ?? fetch;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;
  }

  async listTestDrivers(): Promise<TestDriverListResponse> {
    return parseTestDrivers(await this.#json(await this.#request('/v1/test/drivers', { method: 'GET' })));
  }

  async signInAsTestDriver(driverId: string): Promise<SignInResponse> {
    const response = await this.#request('/v1/test/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId }),
    });
    return parseSignInResponse(await this.#json(response));
  }

  async fetchMe(token: string): Promise<CurrentDriver> {
    return parseCurrentDriver(await this.#json(await this.#request('/v1/me', { method: 'GET', headers: bearer(token) })));
  }

  async acceptNotice(token: string, noticeVersion: string): Promise<void> {
    await this.#request('/v1/consent', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticeVersion }),
    });
  }

  async signOut(token: string): Promise<void> {
    await this.#request('/v1/sign-out', { method: 'POST', headers: bearer(token) });
  }

  async #request(path: string, init: RequestInit): Promise<Response> {
    const response = await this.#fetchWithinTimeout(`${this.#baseUrl}${path}`, init);
    if (response.status === UNAUTHORIZED) {
      throw new PalierUnauthorizedError();
    }
    if (!response.ok) {
      throw new PalierStatusError(response.status);
    }
    return response;
  }

  async #fetchWithinTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMilliseconds);
    try {
      return await this.#fetchFunction(url, { ...init, signal: controller.signal });
    } catch (error) {
      throw new PalierUnreachableError('network error or timeout', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  async #json(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new PalierUnreachableError('response body is not JSON', { cause: error });
    }
  }
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
