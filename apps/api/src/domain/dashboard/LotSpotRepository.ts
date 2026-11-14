import type { DashboardAisleSpots, DashboardErrorCode } from '@palier/shared-types';
import type { SpotAttributes } from '@palier/shared-types/spotDraft';

export type LotSpotRefusal = Extract<DashboardErrorCode, 'LOT_NOT_FOUND' | 'LOT_BUSY' | 'AISLE_NOT_FOUND' | 'SPOT_NOT_FOUND' | 'SPOT_LIMIT_REACHED' | 'SPOT_IN_USE' | 'SPOT_STILL_ASSIGNED'>;

// The aisle whose spots changed, read again once the write is committed.
export interface SpotsWritten {
  readonly aisleId: string;
}

// The lot already has a live spot that reads the same as one of the new numbers; nothing was saved.
export interface SpotNumberTaken {
  readonly takenNumber: string;
}

export type LotSpotWrite = SpotsWritten | SpotNumberTaken | LotSpotRefusal;

export interface AislePlace {
  readonly lotId: string;
  readonly aisleId: string;
}

export interface SpotPlace {
  readonly lotId: string;
  readonly spotId: string;
}

export interface SpotBatch {
  readonly numbers: readonly string[];
  readonly attributes: SpotAttributes;
}

// Every statement names the operator; a write first locks the operator's lot, so another operator's lot is LOT_NOT_FOUND before anything else is read.
// A retired spot is never read, changed or counted: it is SPOT_NOT_FOUND, and its number is free again.
export interface LotSpotRepository {
  // Null when the aisle is not one the operator's lot drivers park in (another lot's, the exit lane, or none).
  readAisleSpots(operatorId: string, aisle: AislePlace): Promise<DashboardAisleSpots | null>;
  // One insert for the whole batch, or nothing: an aisle, then the lot's spot limit, then the numbers already taken.
  addSpots(operatorId: string, aisle: AislePlace, batch: SpotBatch): Promise<LotSpotWrite>;
  changeSpot(operatorId: string, spot: SpotPlace, attributes: SpotAttributes): Promise<LotSpotWrite>;
  // A spot in use is refused; a spot without history is deleted, one with history is retired out of service.
  retireSpot(operatorId: string, spot: SpotPlace): Promise<LotSpotWrite>;
}
