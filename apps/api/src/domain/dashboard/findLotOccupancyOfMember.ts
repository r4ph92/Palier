import type { DashboardLotOccupancy } from '@palier/shared-types';
import { computeCounterGap } from './counterGap.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { LevelOccupancy, LevelOccupancyReader } from './LevelOccupancyReader.ts';
import type { OperatorRepository } from './OperatorRepository.ts';

export interface LotOccupancySources {
  readonly operators: Pick<OperatorRepository, 'findOperatorOfMember'>;
  readonly occupancy: LevelOccupancyReader;
}

// Another operator's lot and a lot that does not exist give the same answer, so ids reveal nothing.
export async function findLotOccupancyOfMember({ operators, occupancy }: LotOccupancySources, userId: string, lotId: string): Promise<DashboardLotOccupancy> {
  const operator = await operators.findOperatorOfMember(userId);
  if (operator === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  const read = await occupancy.readLevelOccupancy(operator.id, lotId);
  if (read === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  const occupiedOrAssignedCount = occupiedOrAssignedCountOf(read);
  return {
    lotId,
    lotName: read.lotName,
    vehicleCount: read.vehicleCount,
    levels: read.levels,
    occupiedOrAssignedCount,
    counterGap: computeCounterGap(read.vehicleCount, occupiedOrAssignedCount),
  };
}

function occupiedOrAssignedCountOf({ levels, confirmedAssignedCount }: LevelOccupancy): number {
  const taken = levels.reduce((total, { counts }) => total + counts.OCCUPIED + counts.OCCUPIED_UNKNOWN, 0);
  return taken + confirmedAssignedCount;
}
