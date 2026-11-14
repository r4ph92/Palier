import type { DashboardLotMap, DashboardMapAisle, DashboardMapLevel } from '@palier/shared-types';
import { batteryStatusOf } from '../equipment/batteryStatus.ts';
import type { StoredLotMap, StoredMapAisle, StoredMapLevel } from './LotMapRepository.ts';

// What each battery reading means at the moment of the read, so a reading turns unknown without anyone writing.
export function lotMapViewOf(map: StoredLotMap, now: Date): DashboardLotMap {
  return { ...map, levels: map.levels.map((level) => levelViewOf(level, now)) };
}

function levelViewOf(level: StoredMapLevel, now: Date): DashboardMapLevel {
  return { ...level, aisles: level.aisles.map((aisle) => aisleViewOf(aisle, now)) };
}

function aisleViewOf(aisle: StoredMapAisle, now: Date): DashboardMapAisle {
  const { batteryPercent: percent, batteryReportedAt: reportedAt } = aisle;
  return { ...aisle, batteryReportedAt: reportedAt?.toISOString() ?? null, batteryStatus: batteryStatusOf({ percent, reportedAt }, now) };
}
