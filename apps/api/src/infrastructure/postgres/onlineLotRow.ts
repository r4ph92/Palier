import type { GeoPosition } from '@palier/shared-types';
import { isOnEarth } from '@palier/shared-types/lots';
import type { OnlineLot } from '../../domain/lots/OnlineLot.ts';
import { PricingPolicyInvalidError, readLotPricing } from '../../domain/pricing/PricingPolicy.ts';
import { isAboveTheLargestPrice } from '../../domain/lots/lotTerms.ts';
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
  readonly assignedSpotCount: number;
  readonly pricingPolicy: unknown;
  readonly dailyCapCents: number | null;
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
      assignedSpotCount: row.assignedSpotCount,
      availableSpotCount: availableSpotCount(availableSpots),
      availableByCategory: availableByCategory(availableSpots),
    },
    tariff: tariffOf(row),
  };
}

// A price that cannot be read, or above the largest one (#151), is listed without a tariff: the lot still shows, and its entry refuses LOT_NOT_IN_SERVICE.
function tariffOf(row: OnlineLotRow): OnlineLot['tariff'] {
  const pricing = readLotPricing(row);
  return pricing instanceof PricingPolicyInvalidError || isAboveTheLargestPrice(pricing) ? null : pricing;
}

function locationFrom({ latitude, longitude }: OnlineLotRow): GeoPosition | null {
  if (latitude === null || longitude === null) {
    return null;
  }
  const location = { latitude: Number(latitude), longitude: Number(longitude) };
  return isOnEarth(location) ? location : null;
}
