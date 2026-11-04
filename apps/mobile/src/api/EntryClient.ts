import type { EntryResponse, EntryStatusResponse } from '@palier/shared-types';

export interface EntryClient {
  // Sends what the entry terminal's QR holds; refusals arrive as PalierRejectedError with the API's code.
  enter(qrContent: string): Promise<EntryResponse>;
  // The driver's own session; the entry loop turns it to ENTRY_CONFIRMED.
  status(sessionId: string): Promise<EntryStatusResponse>;
}
