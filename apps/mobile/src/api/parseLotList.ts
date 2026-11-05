import type { GeoPosition, LotListResponse, LotSummary, SpotCountByCategory } from '@palier/shared-types';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { asRecord } from './asRecord';
import { PalierUnreachableError } from './LotsClient';

export function parseLotList(body: unknown): LotListResponse {
  if (!Array.isArray(body) || !body.every(isLotSummary)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

function isLotSummary(candidate: unknown): candidate is LotSummary {
  const { id, name, freeSpots, freeSpotsByCategory, location } = asRecord(candidate);
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    Number.isInteger(freeSpots) &&
    isSpotCountByCategory(freeSpotsByCategory) &&
    (location === null || isGeoPosition(location))
  );
}

function isSpotCountByCategory(candidate: unknown): candidate is SpotCountByCategory {
  const counts = asRecord(candidate);
  return SPOT_CATEGORIES.every((category) => Number.isInteger(counts[category]));
}

function isGeoPosition(candidate: unknown): candidate is GeoPosition {
  const { latitude, longitude } = asRecord(candidate);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}
