import type { EntryResponse } from '@palier/shared-types';

export interface EntryClient {
  // Sends what the entry terminal's QR holds; refusals arrive as PalierRejectedError with the API's code.
  enter(qrContent: string): Promise<EntryResponse>;
}
