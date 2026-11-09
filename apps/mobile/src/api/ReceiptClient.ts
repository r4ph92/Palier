import type { ReceiptDetailResponse, ReceiptListResponse } from '@palier/shared-types';

export interface ReceiptClient {
  // The driver's closed, paid sessions, newest first.
  listReceipts(): Promise<ReceiptListResponse>;
  // One of the driver's own receipts; any other id fails like an unreachable Palier (a 404 is a PalierStatusError).
  findReceipt(sessionId: string): Promise<ReceiptDetailResponse>;
}
