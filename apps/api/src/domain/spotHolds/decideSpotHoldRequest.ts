import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { hasRoomForAnotherVehicle, type LotOccupancy } from '../occupancy/hasRoomForAnotherVehicle.ts';

// Read under the lot lock, so no other hold of this lot changes them before the decision is applied.
export interface SpotHoldFacts {
  readonly isLotOnline: boolean;
  readonly hasOwnActiveHold: boolean;
  readonly activeHoldsInLot: number;
  readonly holdQuota: number;
  readonly occupancy: LotOccupancy;
}

export type SpotHoldDecision = { readonly kind: 'proceed' } | { readonly kind: 'refuse'; readonly reason: SpotHoldRefusalCode };

export function decideSpotHoldRequest(facts: SpotHoldFacts): SpotHoldDecision {
  const reason = refusalReason(facts);
  return reason === null ? { kind: 'proceed' } : { kind: 'refuse', reason };
}

function refusalReason({ isLotOnline, hasOwnActiveHold, activeHoldsInLot, holdQuota, occupancy }: SpotHoldFacts): SpotHoldRefusalCode | null {
  if (!isLotOnline) {
    return 'LOT_NOT_IN_SERVICE';
  }
  if (hasOwnActiveHold) {
    return 'HOLD_ALREADY_EXISTS';
  }
  if (activeHoldsInLot >= holdQuota) {
    return 'HOLD_QUOTA_REACHED';
  }
  return hasRoomForAnotherVehicle(occupancy) ? null : 'NO_SUITABLE_SPOT';
}
