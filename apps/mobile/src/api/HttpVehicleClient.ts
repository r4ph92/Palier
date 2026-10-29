import type { Vehicle, VehicleListResponse } from '@palier/shared-types';
import { PalierUnauthorizedError } from './AuthClient';
import { PalierConsentRequiredError, PalierRejectedError, type NewVehicleInput, type VehicleClient } from './VehicleClient';
import { PalierStatusError, PalierUnreachableError } from './LotsClient';
import { parseVehicle, parseVehicleList } from './parseVehicles';

const DEFAULT_TIMEOUT_MILLISECONDS = 8000;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const BAD_REQUEST = 400;
const CONFLICT = 409;
const CONSENT_REQUIRED = 'CONSENT_REQUIRED';

export interface HttpVehicleClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly onUnauthorized: () => void;
  readonly onConsentRequired: () => void;
  readonly fetchFunction?: typeof fetch;
  readonly timeoutMilliseconds?: number;
}

export class HttpVehicleClient implements VehicleClient {
  readonly #options: HttpVehicleClientOptions;
  readonly #fetchFunction: typeof fetch;
  readonly #timeoutMilliseconds: number;

  constructor(options: HttpVehicleClientOptions) {
    this.#options = options;
    this.#fetchFunction = options.fetchFunction ?? fetch;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;
  }

  async listVehicles(): Promise<VehicleListResponse> {
    return parseVehicleList(await readJson(await this.#send('/v1/vehicles', { method: 'GET' })));
  }

  async addVehicle({ plate, province }: NewVehicleInput): Promise<Vehicle> {
    const response = await this.#send('/v1/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate, province }),
    });
    return parseVehicle(await readJson(response));
  }

  async #send(path: string, init: RequestInit): Promise<Response> {
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
    if (response.status === BAD_REQUEST || response.status === CONFLICT) {
      throw new PalierRejectedError((await errorCode(response)) ?? String(response.status));
    }
    if (!response.ok) {
      throw new PalierStatusError(response.status);
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

async function readJson(response: Response): Promise<unknown> {
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
