import type { LevelSpotCounts } from '@palier/shared-types';

export interface LevelOccupancy {
  readonly lotName: string;
  readonly vehicleCount: number;
  readonly levels: readonly LevelSpotCounts[];
  readonly confirmedAssignedCount: number;
}

export interface LevelOccupancyReader {
  // Null when the operator has no lot with this id, so another operator's lot reads as absent.
  readLevelOccupancy(operatorId: string, lotId: string): Promise<LevelOccupancy | null>;
}
