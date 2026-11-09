import type { ReceiptDetailResponse, ReceiptListResponse } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import { parseReceiptDetail, parseReceiptList } from './parseReceipts';
import type { ReceiptClient } from './ReceiptClient';

export class HttpReceiptClient implements ReceiptClient {
  readonly #requester: AuthorizedRequester;

  constructor(options: AuthorizedClientOptions) {
    this.#requester = new AuthorizedRequester(options, new Set());
  }

  async listReceipts(): Promise<ReceiptListResponse> {
    return parseReceiptList(await readJson(await this.#requester.send('/v1/me/receipts', { method: 'GET' })));
  }

  async findReceipt(sessionId: string): Promise<ReceiptDetailResponse> {
    const response = await this.#requester.send(`/v1/me/receipts/${encodeURIComponent(sessionId)}`, { method: 'GET' });
    return parseReceiptDetail(await readJson(response));
  }
}
