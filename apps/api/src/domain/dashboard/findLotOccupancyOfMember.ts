import type { DashboardLotOccupancy } from '@palier/shared-types';
import { computeCounterGap } from './counterGap.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { LevelOccupancy, LevelOccupancyReader } from './LevelOccupancyReader.ts';
import { readOwnedLotGates, silentGateNamesOf, type LotEquipmentSources } from './lotEquipment.ts';
import { operatorIdOfMember, type MemberLot } from './memberOperator.ts';

export interface LotOccupancySources extends LotEquipmentSources {
  readonly occupancy: LevelOccupancyReader;
}

// Another operator's lot and a lot that does not exist give the same answer, so ids reveal nothing.
export async function findLotOccupancyOfMember(sources: LotOccupancySources, lot: MemberLot): Promise<DashboardLotOccupancy> {
  const operatorId = await operatorIdOfMember(sources.operators, lot.userId);
  const read = await sources.occupancy.readLevelOccupancy(operatorId, lot.lotId);
  if (read === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  const { gates } = await readOwnedLotGates(sources.equipment, operatorId, lot.lotId);
  const occupiedOrAssignedCount = occupiedOrAssignedCountOf(read);
  return {
    lotId: lot.lotId,
    lotName: read.lotName,
    vehicleCount: read.vehicleCount,
    levels: read.levels,
    occupiedOrAssignedCount,
    counterGap: computeCounterGap(read.vehicleCount, occupiedOrAssignedCount),
    silentGateNames: silentGateNamesOf(gates, sources.clock()),
  };
}

function occupiedOrAssignedCountOf({ levels, confirmedAssignedCount }: LevelOccupancy): number {
  const taken = levels.reduce((total, { counts }) => total + counts.OCCUPIED + counts.OCCUPIED_UNKNOWN, 0);
  return taken + confirmedAssignedCount;
}
