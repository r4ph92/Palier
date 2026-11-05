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

export interface SpotHoldRepository {
  findActiveSpotHold(driverId: string): Promise<SpotHold | null>;
  findSpotHoldLot(lotId: string): Promise<SpotHoldLot | null>;
  // Under the lot lock; refuses with SpotHoldRefusedError: decideSpotHoldRequest, NO_SUITABLE_SPOT, HOLD_UNAVAILABLE on a lock timeout.
  placeSpotHold(draft: SpotHoldDraft): Promise<SpotHold>;
}
