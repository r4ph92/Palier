import type { LevelSpotCounts } from '@palier/shared-types';

export interface LevelOccupancy {
  readonly lotName: string;
  readonly vehicleCount: number;
  readonly levels: readonly LevelSpotCounts[];
  // ASSIGNED spots whose session has its entry confirmed: an admitted vehicle that has not yet crossed the loop is not counted.
  readonly confirmedAssignedCount: number;
}

export interface LevelOccupancyReader {
  // Null when the operator has no lot with this id, so another operator's lot reads as absent.
  readLevelOccupancy(operatorId: string, lotId: string): Promise<LevelOccupancy | null>;
}
