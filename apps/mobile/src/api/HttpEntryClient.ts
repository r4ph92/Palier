import type { EntryResponse } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import type { EntryClient } from './EntryClient';
import { parseEntry } from './parseEntry';
import { PalierRejectedError } from './VehicleClient';

const BAD_REQUEST = 400;
const PAYMENT_REQUIRED = 402;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;
const SCHEMA_REFUSAL = 'FST_ERR_VALIDATION';
const ENTRY_REFUSAL_STATUSES = new Set([BAD_REQUEST, PAYMENT_REQUIRED, CONFLICT, TOO_MANY_REQUESTS, SERVICE_UNAVAILABLE]);

export class HttpEntryClient implements EntryClient {
  readonly #requester: AuthorizedRequester;

  constructor(options: AuthorizedClientOptions) {
    this.#requester = new AuthorizedRequester(options, ENTRY_REFUSAL_STATUSES);
  }

  async enter(qrContent: string): Promise<EntryResponse> {
    const response = await this.#send(qrContent);
    return parseEntry(await readJson(response));
  }

  // The API's schema refuses an oversized QR content before reading the token: for the driver it is the same unreadable QR.
  async #send(qrContent: string): Promise<Response> {
    try {
      return await this.#requester.send('/v1/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrContent }),
      });
    } catch (error) {
      if (error instanceof PalierRejectedError && error.code === SCHEMA_REFUSAL) {
        throw new PalierRejectedError('QR_NOT_RECOGNIZED');
      }
      throw error;
    }
  }
}
