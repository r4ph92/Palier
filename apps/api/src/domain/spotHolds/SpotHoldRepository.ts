import type { LotTermsInput } from '../lots/lotTerms.ts';
import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';
import type { SpotHold } from './SpotHold.ts';

export type SpotHoldLot = LotTermsInput;

export interface SpotHoldDraft {
  readonly driverId: string;
  readonly lotId: string;
  readonly needs: VehicleNeeds;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface SpotHoldRelease {
  readonly driverId: string;
  readonly spotHoldId: string;
  readonly lotId: string;
  readonly releasedAt: Date;
}

export interface SpotHoldExpiry {
  readonly expired: number;
  readonly freed: number;
}

export interface SpotHoldRepository {
  findActiveSpotHold(driverId: string): Promise<SpotHold | null>;
  // Matches the id and the driver in one predicate: another driver's hold is indistinguishable from none.
  findOwnActiveSpotHold(driverId: string, spotHoldId: string): Promise<SpotHold | null>;
  findSpotHoldLot(lotId: string): Promise<SpotHoldLot | null>;
  // Under the lot lock; refuses with SpotHoldRefusedError: decideSpotHoldRequest, NO_SUITABLE_SPOT, HOLD_UNAVAILABLE on a lock timeout.
  placeSpotHold(draft: SpotHoldDraft): Promise<SpotHold>;
  // Under the lot lock; refuses with SpotHoldRefusedError: HOLD_NOT_FOUND when a concurrent release won, HOLD_UNAVAILABLE on a lock timeout.
  releaseSpotHold(release: SpotHoldRelease): Promise<void>;
  // Lots with a hold whose end has passed: read without the lot lock, so each lot is then expired apart.
  findLotsWithExpiredHolds(now: Date): Promise<string[]>;
  // Under the lot lock; a hold already released or expired by a concurrent run is not counted. Throws on a lock timeout.
  expireLotSpotHolds(lotId: string, now: Date): Promise<SpotHoldExpiry>;
}
