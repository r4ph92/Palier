import { palierFetch } from './appUpdate';
import { PalierUnauthorizedError } from './AuthClient';
import { PalierStatusError, PalierUnreachableError } from './LotsClient';

const DEFAULT_TIMEOUT_MILLISECONDS = 8000;
const UNAUTHORIZED = 401;

export interface AuthRequesterOptions {
  readonly baseUrl: string;
  readonly fetchFunction?: typeof fetch;
  readonly timeoutMilliseconds?: number;
}

export class AuthRequester {
  readonly #baseUrl: string;
  readonly #fetchFunction: typeof fetch;
  readonly #timeoutMilliseconds: number;

  constructor(options: AuthRequesterOptions) {
    this.#baseUrl = options.baseUrl;
    this.#fetchFunction = options.fetchFunction ?? palierFetch;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;
  }

  async request(path: string, init: RequestInit): Promise<Response> {
    const response = await this.#fetchWithinTimeout(`${this.#baseUrl}${path}`, init);
    if (response.status === UNAUTHORIZED) {
      throw new PalierUnauthorizedError();
    }
    if (!response.ok) {
      throw new PalierStatusError(response.status);
    }
    return response;
  }

  async json(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new PalierUnreachableError('response body is not JSON', { cause: error });
    }
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
}
