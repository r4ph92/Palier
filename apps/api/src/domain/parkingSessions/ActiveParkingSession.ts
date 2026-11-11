import type { ActiveEntrySessionState, AssignedSpot, ParkedQuestion } from '@palier/shared-types';
import type { StoredLevelAisle } from '../lots/levelPlanOf.ts';
import type { PricingPolicy } from '../pricing/PricingPolicy.ts';

export interface ActiveParkingSession {
  readonly id: string;
  readonly state: ActiveEntrySessionState;
  readonly lotName: string;
  readonly spot: AssignedSpot;
  // The entry scan, not the loop confirmation: billing and the shown entry time both start there.
  readonly enteredAt: Date;
  readonly pricing: PricingPolicy;
  readonly beaconMajor: number | null;
  // This session and another one of its lot both reported the exit beacon within the window (decision 029).
  readonly exitBeaconFallback: boolean;
  // Every aisle of the spot's level the driver can drive in, ordered by code; the level plan is drawn from them.
  readonly levelAisles: readonly StoredLevelAisle[];
  readonly question: ParkedQuestion | null;
}

export interface CurrentParkingSessionQuery {
  // At most one, guaranteed by the per-driver partial unique index; null when the driver has none.
  findCurrentParkingSessionForUser(userId: string): Promise<ActiveParkingSession | null>;
}
