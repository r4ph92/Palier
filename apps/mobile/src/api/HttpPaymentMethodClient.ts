import type { SavedCard } from '@palier/shared-types';
import { PalierStatusError, PalierUnreachableError } from './LotsClient';
import type { PaymentMethodClient } from './PaymentMethodClient';
import { parseClientSecret, parsePaymentCard, parseSavedCard } from './parsePaymentMethodResponses';

const DEFAULT_TIMEOUT_MILLISECONDS = 8000;
const UNAUTHORIZED = 401;

export interface HttpPaymentMethodClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly onUnauthorized: () => void;
  readonly fetchFunction?: typeof fetch;
  readonly timeoutMilliseconds?: number;
}

export class HttpPaymentMethodClient implements PaymentMethodClient {
  readonly #options: HttpPaymentMethodClientOptions;

  constructor(options: HttpPaymentMethodClientOptions) {
    this.#options = options;
  }

  async fetchCard(): Promise<SavedCard | null> {
    return parsePaymentCard(await this.#send('GET', '/v1/me/payment-method'));
  }

  async createSetupIntent(): Promise<string> {
    return parseClientSecret(await this.#send('POST', '/v1/me/setup-intent'));
  }

  async saveCard(paymentMethodId: string): Promise<SavedCard> {
    return parseSavedCard(await this.#send('PUT', '/v1/me/payment-method', { paymentMethodId }));
  }

  async #send(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<unknown> {
    const response = await this.#fetch(method, path, body);
    if (response.status === UNAUTHORIZED) {
      this.#options.onUnauthorized();
    }
    if (!response.ok) {
      throw new PalierStatusError(response.status);
    }
    return this.#readJson(response);
  }

  async #fetch(method: string, path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS);
    const fetchFunction = this.#options.fetchFunction ?? fetch;
    try {
      return await fetchFunction(`${this.#options.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: this.#headers(body),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new PalierUnreachableError('network error or timeout', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  #headers(body: unknown): Record<string, string> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.#options.token}` };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  async #readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new PalierUnreachableError('response body is not JSON', { cause: error });
    }
  }
}
