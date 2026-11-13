import type { DashboardErrorCode, DashboardLotMap } from '@palier/shared-types';
import type { AisleDraft } from '@palier/shared-types/aisleDraft';

export type LotMapRefusal = Extract<
  DashboardErrorCode,
  'LOT_NOT_FOUND' | 'LOT_BUSY' | 'LEVEL_CODE_TAKEN' | 'LEVEL_LIMIT_REACHED' | 'LEVEL_ORDER_INVALID' | 'LEVEL_NOT_FOUND' | 'AISLE_CODE_TAKEN' | 'AISLE_MINOR_TAKEN'
>;

// Null when the change was written.
export type LotMapWrite = LotMapRefusal | null;

export interface LevelPlacement {
  readonly lotId: string;
  readonly levelId: string;
}

// Every statement names the operator, so a member only ever reads or changes the map of a lot of their own operator.
// A write first locks the operator's lot: another operator's lot is LOT_NOT_FOUND before anything else is read.
export interface LotMapRepository {
  // Null when the operator has no lot with this id.
  readLotMap(operatorId: string, lotId: string): Promise<DashboardLotMap | null>;
  // Appends the level; the lot's first level also gets the exit lane, minor 0.
  addLevel(operatorId: string, lotId: string, code: string): Promise<LotMapWrite>;
  reorderLevels(operatorId: string, lotId: string, levelIds: readonly string[]): Promise<LotMapWrite>;
  addAisle(operatorId: string, placement: LevelPlacement, aisle: AisleDraft): Promise<LotMapWrite>;
}
