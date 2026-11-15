import type { DashboardSpotsToCheck } from '@palier/shared-types';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import { operatorIdOfMember, type MemberLot, type MemberOperators } from './memberOperator.ts';
import type { SpotCheckRepository } from './SpotCheckRepository.ts';
import type { MemberSpot } from './lotSpots.ts';

export interface SpotCheckSources {
  readonly operators: MemberOperators;
  readonly spotChecks: SpotCheckRepository;
}

export async function readSpotsToCheckOfMember(sources: SpotCheckSources, lot: MemberLot): Promise<DashboardSpotsToCheck> {
  return listOwnedSpotsToCheck(sources.spotChecks, await operatorIdOfMember(sources.operators, lot), lot.lotId);
}

// Answers the list after the clear, so the page shows what is still flagged.
export async function clearSpotCheckOfMember(sources: SpotCheckSources, spot: MemberSpot): Promise<DashboardSpotsToCheck> {
  const operatorId = await operatorIdOfMember(sources.operators, spot);
  const outcome = await sources.spotChecks.clearSpotCheck(operatorId, { lotId: spot.lotId, spotId: spot.spotId });
  if (outcome !== 'CLEARED') {
    throw new DashboardRefusedError(outcome);
  }
  return listOwnedSpotsToCheck(sources.spotChecks, operatorId, spot.lotId);
}

async function listOwnedSpotsToCheck(spotChecks: SpotCheckRepository, operatorId: string, lotId: string): Promise<DashboardSpotsToCheck> {
  const listed = await spotChecks.listSpotsToCheck(operatorId, lotId);
  if (listed === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  return listed;
}
