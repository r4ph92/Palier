import type { GeoPosition } from '@palier/shared-types';
import { isOnEarth } from '@palier/shared-types/lots';
import type { OnlineLot } from '../../domain/lots/OnlineLot.ts';
import { availableByCategory, availableSpotCount, type AvailableSpotGroup } from '../../domain/occupancy/availableByCategory.ts';

// Postgres numeric columns arrive as strings.
export interface OnlineLotRow {
  readonly id: string;
  readonly name: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly capacity: number;
  readonly vehicleCount: number;
  readonly heldSpotCount: number;
}

export function onlineLotFromRow(row: OnlineLotRow, availableSpots: readonly AvailableSpotGroup[]): OnlineLot {
  return {
    id: row.id,
    name: row.name,
    location: locationFrom(row),
    availability: {
      capacity: row.capacity,
      vehicleCount: row.vehicleCount,
      heldSpotCount: row.heldSpotCount,
      availableSpotCount: availableSpotCount(availableSpots),
      availableByCategory: availableByCategory(availableSpots),
    },
  };
}

function locationFrom({ latitude, longitude }: OnlineLotRow): GeoPosition | null {
  if (latitude === null || longitude === null) {
    return null;
  }
  const location = { latitude: Number(latitude), longitude: Number(longitude) };
  return isOnEarth(location) ? location : null;
}
