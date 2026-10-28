import type { LotListResponse, LotSummary } from '@palier/shared-types';
import { PalierUnreachableError } from './LotsClient';

export function parseLotList(body: unknown): LotListResponse {
  if (!Array.isArray(body) || !body.every(isLotSummary)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

function isLotSummary(candidate: unknown): candidate is LotSummary {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const { id, name, freeSpots } = candidate as Record<string, unknown>;
  return typeof id === 'string' && typeof name === 'string' && Number.isInteger(freeSpots);
}
