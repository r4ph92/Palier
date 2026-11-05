import type { GeoPosition } from '@palier/shared-types';
import type { OnlineLot } from '../../domain/lots/OnlineLot.ts';

// Postgres numeric columns arrive as strings; counts arrive as numbers through mapWith(Number).
export interface OnlineLotRow {
  readonly id: string;
  readonly name: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly capacity: number;
  readonly vehicleCount: number;
  readonly availableSpotCount: number;
  readonly availableStandard: number;
  readonly availableElectric: number;
  readonly availableAccessible: number;
  readonly availableOversize: number;
}

export function onlineLotFromRow(row: OnlineLotRow): OnlineLot {
  return {
    id: row.id,
    name: row.name,
    location: locationFrom(row),
    availability: {
      capacity: row.capacity,
      vehicleCount: row.vehicleCount,
      availableSpotCount: row.availableSpotCount,
      availableByCategory: {
        standard: row.availableStandard,
        electric: row.availableElectric,
        accessible: row.availableAccessible,
        oversize: row.availableOversize,
      },
    },
  };
}

function locationFrom({ latitude, longitude }: OnlineLotRow): GeoPosition | null {
  if (latitude === null || longitude === null) {
    return null;
  }
  return { latitude: Number(latitude), longitude: Number(longitude) };
}
