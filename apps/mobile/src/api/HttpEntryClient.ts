import type { EntryQuoteResponse, EntryRequest, EntryResponse, EntryStatusResponse, TariffPolicy } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import type { EntryClient } from './EntryClient';
import { parseEntry } from './parseEntry';
import { parseEntryQuote } from './parseEntryQuote';
import { parseEntryStatus } from './parseEntryStatus';

const BAD_REQUEST = 400;
const PAYMENT_REQUIRED = 402;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;
const ENTRY_REFUSAL_STATUSES = new Set([BAD_REQUEST, PAYMENT_REQUIRED, CONFLICT, TOO_MANY_REQUESTS, SERVICE_UNAVAILABLE]);

export class HttpEntryClient implements EntryClient {
  readonly #requester: AuthorizedRequester;
  readonly #statusRequester: AuthorizedRequester;

  constructor(options: AuthorizedClientOptions) {
    this.#requester = new AuthorizedRequester(options, ENTRY_REFUSAL_STATUSES);
    this.#statusRequester = new AuthorizedRequester(options, new Set());
  }

  async quote(qrContent: string): Promise<EntryQuoteResponse> {
    const response = await this.#requester.send('/v1/entries/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrContent }),
    });
    return parseEntryQuote(await readJson(response));
  }

  async enter(qrContent: string, tariff: TariffPolicy): Promise<EntryResponse> {
    const body: EntryRequest = { qrContent, tariff };
    const response = await this.#requester.send('/v1/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseEntry(await readJson(response));
  }

  async status(sessionId: string): Promise<EntryStatusResponse> {
    const response = await this.#statusRequester.send(`/v1/entries/${encodeURIComponent(sessionId)}`, { method: 'GET' });
    return parseEntryStatus(await readJson(response));
  }
}
