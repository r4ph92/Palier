import type { GeoPosition, LotSummary } from '@palier/shared-types';
import { distanceBetween } from './distanceBetween';

export const NEARBY_RADIUS_METRES = 10_000;

export interface NearbyLot {
  readonly lot: LotSummary;
  readonly distanceMetres: number | null;
}

// Without a position, every lot stays in the API's name order. With one, a lot without coordinates cannot be within the radius.
export function nearbyLots(lots: readonly LotSummary[], position: GeoPosition | null): readonly NearbyLot[] {
  if (position === null) {
    return lots.map((lot) => ({ lot, distanceMetres: null }));
  }
  return lots
    .flatMap((lot) => (lot.location === null ? [] : [{ lot, distanceMetres: distanceBetween(position, lot.location) }]))
    .filter(({ distanceMetres }) => distanceMetres <= NEARBY_RADIUS_METRES)
    .sort((first, second) => first.distanceMetres - second.distanceMetres);
}
