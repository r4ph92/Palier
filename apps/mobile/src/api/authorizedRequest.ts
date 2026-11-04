import { palierFetch } from './appUpdate';
import { PalierUnauthorizedError } from './AuthClient';
import { PalierStatusError, PalierUnreachableError } from './LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from './VehicleClient';

const DEFAULT_TIMEOUT_MILLISECONDS = 8000;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const CONSENT_REQUIRED = 'CONSENT_REQUIRED';

export interface AuthorizedClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly onUnauthorized: () => void;
  readonly onConsentRequired: () => void;
  readonly fetchFunction?: typeof fetch;
  readonly timeoutMilliseconds?: number;
}

// Sends a driver request and turns refusals into errors: a refused token or a missing notice also calls back the app,
// and the statuses a client lists as rejections carry the API's reason code.
export class AuthorizedRequester {
  readonly #options: AuthorizedClientOptions;
  readonly #rejectedStatuses: ReadonlySet<number>;
  readonly #fetchFunction: typeof fetch;

  constructor(options: AuthorizedClientOptions, rejectedStatuses: ReadonlySet<number>) {
    this.#options = options;
    this.#rejectedStatuses = rejectedStatuses;
    this.#fetchFunction = options.fetchFunction ?? palierFetch;
  }

  async send(path: string, init: RequestInit): Promise<Response> {
    const response = await this.#fetchWithinTimeout(`${this.#options.baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.#options.token}` },
    });
    await this.#refuseIfNotOk(response);
    return response;
  }

  async #refuseIfNotOk(response: Response): Promise<void> {
    if (response.status === UNAUTHORIZED) {
      this.#options.onUnauthorized();
      throw new PalierUnauthorizedError();
    }
    if (response.status === FORBIDDEN && (await errorCode(response)) === CONSENT_REQUIRED) {
      this.#options.onConsentRequired();
      throw new PalierConsentRequiredError();
    }
    if (this.#rejectedStatuses.has(response.status)) {
      throw new PalierRejectedError((await errorCode(response)) ?? String(response.status));
    }
    if (!response.ok) {
      throw new PalierStatusError(response.status);
    }
  }

  async #fetchWithinTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS);
    try {
      return await this.#fetchFunction(url, { ...init, signal: controller.signal });
    } catch (error) {
      throw new PalierUnreachableError('network error or timeout', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new PalierUnreachableError('response body is not JSON', { cause: error });
  }
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const { error } = (await response.json()) as { error?: unknown };
    return typeof error === 'string' ? error : undefined;
  } catch {
    return undefined;
  }
}
