import type { GeoPosition, LotListResponse, LotSummary, SpotCountByCategory } from '@palier/shared-types';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { PalierUnreachableError } from './LotsClient';

export function parseLotList(body: unknown): LotListResponse {
  if (!Array.isArray(body) || !body.every(isLotSummary)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

function isLotSummary(candidate: unknown): candidate is LotSummary {
  if (!isRecord(candidate)) {
    return false;
  }
  const { id, name, freeSpots, freeSpotsByCategory, location } = candidate;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    Number.isInteger(freeSpots) &&
    isSpotCountByCategory(freeSpotsByCategory) &&
    (location === null || isGeoPosition(location))
  );
}

function isSpotCountByCategory(candidate: unknown): candidate is SpotCountByCategory {
  return isRecord(candidate) && SPOT_CATEGORIES.every((category) => Number.isInteger(candidate[category]));
}

function isGeoPosition(candidate: unknown): candidate is GeoPosition {
  return isRecord(candidate) && Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude);
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null;
}
