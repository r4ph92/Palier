import type { ActiveEntrySessionState, AssignedSpot } from '@palier/shared-types';
import type { PricingPolicy } from '../pricing/PricingPolicy.ts';

export interface ActiveParkingSession {
  readonly id: string;
  readonly state: ActiveEntrySessionState;
  readonly lotName: string;
  readonly spot: AssignedSpot;
  // The entry scan, not the loop confirmation: billing and the shown entry time both start there.
  readonly enteredAt: Date;
  readonly pricing: PricingPolicy;
}

export interface CurrentParkingSessionQuery {
  // At most one, guaranteed by the per-driver partial unique index; null when the driver has none.
  findCurrentParkingSessionForUser(userId: string): Promise<ActiveParkingSession | null>;
}
