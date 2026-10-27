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

  async listLots(): Promise<LotListResponse> {
    const response = await this.#get('/v1/lots');
    if (!response.ok) {
      throw new PalierUnreachableError(`HTTP ${response.status}`);
    }
    return parseLotList(await this.#readJson(response));
  }

  async #get(path: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMilliseconds);
    try {
      return await this.#fetchFunction(`${this.#baseUrl}${path}`, { signal: controller.signal });
    } catch (error) {
      throw new PalierUnreachableError(error instanceof Error ? error.message : 'network error');
    } finally {
      clearTimeout(timeout);
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
