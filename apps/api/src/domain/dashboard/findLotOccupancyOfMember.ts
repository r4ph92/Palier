import type { DashboardLotOccupancy } from '@palier/shared-types';
import { computeCounterGap } from './counterGap.ts';
import type { LevelOccupancy, LevelOccupancyReader } from './LevelOccupancyReader.ts';
import { silentGateNamesOf, type LotEquipmentSources } from './lotEquipment.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot } from './memberOperator.ts';

export interface LotOccupancySources extends LotEquipmentSources {
  readonly occupancy: LevelOccupancyReader;
}

// The figures and the gates are read side by side: neither read depends on the other.
export async function findLotOccupancyOfMember(sources: LotOccupancySources, lot: MemberLot): Promise<DashboardLotOccupancy> {
  const operatorId = await operatorIdOfMember(sources.operators, lot.userId);
  const [occupancy, gates] = await Promise.all([sources.occupancy.readLevelOccupancy(operatorId, lot.lotId), sources.equipment.readLotGates(operatorId, lot.lotId)]);
  const read = ownedLotOrNotFound(occupancy);
  const occupiedOrAssignedCount = occupiedOrAssignedCountOf(read);
  return {
    lotId: lot.lotId,
    lotName: read.lotName,
    vehicleCount: read.vehicleCount,
    levels: read.levels,
    occupiedOrAssignedCount,
    counterGap: computeCounterGap(read.vehicleCount, occupiedOrAssignedCount),
    silentGateNames: silentGateNamesOf(ownedLotOrNotFound(gates).gates, sources.clock()),
  };
}

function occupiedOrAssignedCountOf({ levels, confirmedAssignedCount }: LevelOccupancy): number {
  const taken = levels.reduce((total, { counts }) => total + counts.OCCUPIED + counts.OCCUPIED_UNKNOWN, 0);
  return taken + confirmedAssignedCount;
}
