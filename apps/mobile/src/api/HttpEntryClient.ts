import type { EntryResponse } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import type { EntryClient } from './EntryClient';
import { parseEntry } from './parseEntry';

const BAD_REQUEST = 400;
const PAYMENT_REQUIRED = 402;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;
const ENTRY_REFUSAL_STATUSES = new Set([BAD_REQUEST, PAYMENT_REQUIRED, CONFLICT, TOO_MANY_REQUESTS, SERVICE_UNAVAILABLE]);

export class HttpEntryClient implements EntryClient {
  readonly #requester: AuthorizedRequester;

  constructor(options: AuthorizedClientOptions) {
    this.#requester = new AuthorizedRequester(options, ENTRY_REFUSAL_STATUSES);
  }

  async enter(qrContent: string): Promise<EntryResponse> {
    const response = await this.#requester.send('/v1/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrContent }),
    });
    return parseEntry(await readJson(response));
  }
}
