import type { EntryQuoteResponse, EntryResponse, EntryStatusResponse, TariffPolicy } from '@palier/shared-types';

export interface EntryClient {
  // What the entry terminal's QR leads to: the lot, its tariff and the hold, before anything is held or opened (#151).
  quote(qrContent: string): Promise<EntryQuoteResponse>;
  // Enters at the tariff the driver accepted; refusals arrive as PalierRejectedError with the API's code.
  enter(qrContent: string, tariff: TariffPolicy): Promise<EntryResponse>;
  // The driver's own session; the entry loop turns it to ENTRY_CONFIRMED.
  status(sessionId: string): Promise<EntryStatusResponse>;
}
