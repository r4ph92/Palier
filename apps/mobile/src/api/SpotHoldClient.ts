import type { SpotHold } from '@palier/shared-types';

export interface SpotHoldClient {
  // Guarantees the driver a spot in the lot for 15 minutes; refusals arrive as PalierRejectedError with the API's code.
  hold(lotId: string): Promise<SpotHold>;
  // The driver's active hold, so a relaunch finds it again; null when there is none.
  current(): Promise<SpotHold | null>;
  // Gives the spot back; refusals arrive as PalierRejectedError with the API's code.
  release(spotHoldId: string): Promise<void>;
}
