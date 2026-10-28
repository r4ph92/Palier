import type { LotListResponse } from '@palier/shared-types';
import { PalierStatusError, PalierUnreachableError, type LotsClient } from './LotsClient';
import { parseLotList } from './parseLotList';

const DEFAULT_TIMEOUT_MILLISECONDS = 8000;
const UNAUTHORIZED = 401;

export interface HttpLotsClientOptions {
  readonly baseUrl: string;
  readonly fetchFunction?: typeof fetch;
  readonly timeoutMilliseconds?: number;
  readonly token?: string;
  readonly onUnauthorized?: () => void;
}

export class HttpLotsClient implements LotsClient {
  readonly #baseUrl: string;
  readonly #fetchFunction: typeof fetch;
  readonly #timeoutMilliseconds: number;
  readonly #headers: Record<string, string>;
  readonly #onUnauthorized: () => void;

  constructor(options: HttpLotsClientOptions) {
    this.#baseUrl = options.baseUrl;
    this.#fetchFunction = options.fetchFunction ?? fetch;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;
    this.#headers = options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` };
    this.#onUnauthorized = options.onUnauthorized ?? (() => undefined);
  }

  listLots(): Promise<LotListResponse> {
    return this.#withinTimeout(async (signal) => {
      const response = await this.#get('/v1/lots', signal);
      if (response.status === UNAUTHORIZED) {
        this.#onUnauthorized();
      }
      if (!response.ok) {
        throw new PalierStatusError(response.status);
      }
      return parseLotList(await this.#readJson(response));
    });
  }

  async #withinTimeout<Result>(request: (signal: AbortSignal) => Promise<Result>): Promise<Result> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new PalierUnreachableError(`no complete answer within ${this.#timeoutMilliseconds} ms`));
      }, this.#timeoutMilliseconds);
    });
    try {
      return await Promise.race([request(controller.signal), timedOut]);
    } finally {
      clearTimeout(timeout);
    }
  }

  async #get(path: string, signal: AbortSignal): Promise<Response> {
    try {
      return await this.#fetchFunction(`${this.#baseUrl}${path}`, { signal, headers: this.#headers });
    } catch (error) {
      throw new PalierUnreachableError('network error', { cause: error });
    }
  }

  async #readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new PalierUnreachableError('response body is not JSON', { cause: error });
    }
  }
}
