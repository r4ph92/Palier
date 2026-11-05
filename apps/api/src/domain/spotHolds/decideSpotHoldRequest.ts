import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { hasRoomForAnotherVehicle, type LotOccupancy } from '../occupancy/hasRoomForAnotherVehicle.ts';
import { SPOT_HOLD_QUOTA_PER_LOT } from './spotHoldRules.ts';

// Read under the lot lock, so no other hold of this lot changes them before the decision is applied.
export interface SpotHoldFacts {
  readonly isLotOnline: boolean;
  readonly ownActiveHold: boolean;
  readonly activeHoldsInLot: number;
  readonly occupancy: LotOccupancy;
}

export type SpotHoldDecision = { readonly kind: 'proceed' } | { readonly kind: 'refuse'; readonly reason: SpotHoldRefusalCode };

export function decideSpotHoldRequest(facts: SpotHoldFacts): SpotHoldDecision {
  const reason = refusalReason(facts);
  return reason === null ? { kind: 'proceed' } : { kind: 'refuse', reason };
}

function refusalReason({ isLotOnline, ownActiveHold, activeHoldsInLot, occupancy }: SpotHoldFacts): SpotHoldRefusalCode | null {
  if (!isLotOnline) {
    return 'LOT_NOT_IN_SERVICE';
  }
  if (ownActiveHold) {
    return 'HOLD_ALREADY_EXISTS';
  }
  if (activeHoldsInLot >= SPOT_HOLD_QUOTA_PER_LOT) {
    return 'HOLD_QUOTA_REACHED';
  }
  return hasRoomForAnotherVehicle(occupancy) ? null : 'NO_SUITABLE_SPOT';
}
