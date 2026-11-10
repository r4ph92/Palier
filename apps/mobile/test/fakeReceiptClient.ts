import type { ReceiptDetail, ReceiptDetailResponse, ReceiptListResponse } from '@palier/shared-types';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import type { ReceiptClient } from '../src/api/ReceiptClient';

const NOT_FOUND = 404;

export function julieReceipt(overrides: Partial<ReceiptDetail> = {}): ReceiptDetail {
  return {
    sessionId: 'session-1',
    lotName: 'Parking Démo',
    enteredAt: new Date(2026, 10, 4, 18, 2).toISOString(),
    exitedAt: new Date(2026, 10, 4, 21, 17).toISOString(),
    durationMinutes: 195,
    increments: 13,
    incrementCents: 75,
    totalCents: 975,
    capped: false,
    cardLast4: '4242',
    ...overrides,
  };
}

// The API answers receipts newest first; the fake keeps the order it is given.
export class FakeReceiptClient implements ReceiptClient {
  readonly #receipts: ReceiptDetail[];
  isReachable = true;
  listRequests = 0;

  constructor(receipts: readonly ReceiptDetail[] = []) {
    this.#receipts = [...receipts];
  }

  // A capture the retry took: the receipt now exists.
  add(receipt: ReceiptDetail): void {
    this.#receipts.unshift(receipt);
  }

  listReceipts(): Promise<ReceiptListResponse> {
    this.listRequests += 1;
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    return Promise.resolve({
      receipts: this.#receipts.map(({ sessionId, lotName, exitedAt, durationMinutes, totalCents }) => ({ sessionId, lotName, exitedAt, durationMinutes, totalCents })),
    });
  }

  findReceipt(sessionId: string): Promise<ReceiptDetailResponse> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    const receipt = this.#receipts.find((candidate) => candidate.sessionId === sessionId);
    return receipt === undefined ? Promise.reject(new PalierStatusError(NOT_FOUND)) : Promise.resolve({ receipt });
  }
}
