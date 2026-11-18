import type { GeoPosition, LotListResponse, LotSummary, SpotCountByCategory } from '@palier/shared-types';
import { isOnEarth, SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { asRecord } from './asRecord';
import { isNonNegativeInteger } from './isNonNegativeInteger';
import { isTariff } from './isTariff';
import { PalierUnreachableError } from './LotsClient';

export function parseLotList(body: unknown): LotListResponse {
  if (!Array.isArray(body) || !body.every(isLotSummary)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

function isLotSummary(candidate: unknown): candidate is LotSummary {
  const { id, name, freeSpots, capacity, freeSpotsByCategory, location, tariff } = asRecord(candidate);
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    isNonNegativeInteger(freeSpots) &&
    isNonNegativeInteger(capacity) &&
    isSpotCountByCategory(freeSpotsByCategory) &&
    (location === null || isGeoPosition(location)) &&
    (tariff === null || isTariff(tariff))
  );
}

function isSpotCountByCategory(candidate: unknown): candidate is SpotCountByCategory {
  const counts = asRecord(candidate);
  return SPOT_CATEGORIES.every((category) => isNonNegativeInteger(counts[category]));
}

function isGeoPosition(candidate: unknown): candidate is GeoPosition {
  const { latitude, longitude } = asRecord(candidate);
  return typeof latitude === 'number' && typeof longitude === 'number' && isOnEarth({ latitude, longitude });
}
