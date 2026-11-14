import type { DashboardErrorCode, DashboardLotMap, DashboardMapAisle, DashboardMapLevel, LevelOrderRequest } from '@palier/shared-types';
import type { AisleDraft } from '@palier/shared-types/aisleDraft';
import type { RecordedBatteryReading } from '../equipment/batteryReadings.ts';

export type LotMapRefusal = Extract<
  DashboardErrorCode,
  | 'LOT_NOT_FOUND'
  | 'LOT_BUSY'
  | 'LEVEL_CODE_TAKEN'
  | 'LEVEL_LIMIT_REACHED'
  | 'LEVEL_ORDER_INVALID'
  | 'LEVEL_NOT_FOUND'
  | 'AISLE_CODE_TAKEN'
  | 'AISLE_MINOR_TAKEN'
  | 'AISLE_NOT_FOUND'
>;

export const LOT_MAP_WRITTEN = 'WRITTEN';

export type LotMapWrite = typeof LOT_MAP_WRITTEN | LotMapRefusal;

export interface LevelPlacement {
  readonly lotId: string;
  readonly levelId: string;
}

export interface AislePlacement {
  readonly lotId: string;
  readonly aisleId: string;
}

// The map as stored: the domain adds what each battery reading means at the moment of the read.
export interface StoredMapAisle extends Omit<DashboardMapAisle, 'batteryReportedAt' | 'batteryStatus'> {
  readonly batteryReportedAt: Date | null;
}

export interface StoredMapLevel extends Omit<DashboardMapLevel, 'aisles'> {
  readonly aisles: readonly StoredMapAisle[];
}

export interface StoredLotMap extends Omit<DashboardLotMap, 'levels'> {
  readonly levels: readonly StoredMapLevel[];
}

// Every statement names the operator, so a member only ever reads or changes the map of a lot of their own operator.
// A write first checks the operator's lot: another operator's lot is LOT_NOT_FOUND before anything else is read.
export interface LotMapRepository {
  // Null when the operator has no lot with this id.
  readLotMap(operatorId: string, lotId: string): Promise<StoredLotMap | null>;
  // Appends the level; the lot's first level also gets the exit lane, minor 0.
  addLevel(operatorId: string, lotId: string, code: string): Promise<LotMapWrite>;
  // Refused as LEVEL_ORDER_INVALID unless it moves one level by one place from the current order.
  reorderLevels(operatorId: string, lotId: string, order: LevelOrderRequest): Promise<LotMapWrite>;
  addAisle(operatorId: string, placement: LevelPlacement, aisle: AisleDraft): Promise<LotMapWrite>;
  // No lot lock: a reading changes no spot. The latest reading wins.
  recordBeaconBattery(operatorId: string, placement: AislePlacement, reading: RecordedBatteryReading): Promise<LotMapWrite>;
}
