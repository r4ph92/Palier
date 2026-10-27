import type { LotListResponse } from '@palier/shared-types';
import { PalierUnreachableError, type LotsClient } from './LotsClient';
import { parseLotList } from './parseLotList';

const DEFAULT_TIMEOUT_MILLISECONDS = 8000;

export interface HttpLotsClientOptions {
  readonly baseUrl: string;
  readonly fetchFunction?: typeof fetch;
  readonly timeoutMilliseconds?: number;
}

export class HttpLotsClient implements LotsClient {
  readonly #baseUrl: string;
  readonly #fetchFunction: typeof fetch;
  readonly #timeoutMilliseconds: number;

  constructor(options: HttpLotsClientOptions) {
    this.#baseUrl = options.baseUrl;
    this.#fetchFunction = options.fetchFunction ?? fetch;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;
  }

  listLots(): Promise<LotListResponse> {
    return this.#withinTimeout(async (signal) => {
      const response = await this.#get('/v1/lots', signal);
      if (!response.ok) {
        throw new PalierUnreachableError(`HTTP ${response.status}`);
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
      return await this.#fetchFunction(`${this.#baseUrl}${path}`, { signal });
    } catch (error) {
      throw new PalierUnreachableError(error instanceof Error ? error.message : 'network error');
    }
  }

  async #readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new PalierUnreachableError('response body is not JSON');
    }
  }
}
