import type { AssignedSpot, EntryResponse } from '@palier/shared-types';
import { PalierUnreachableError } from './LotsClient';

export function parseEntry(body: unknown): EntryResponse {
  if (!isEntry(body)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { sessionId: body.sessionId, spot: body.spot, barrierOpened: true };
}

function isEntry(candidate: unknown): candidate is EntryResponse {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const { sessionId, spot, barrierOpened } = candidate as Record<string, unknown>;
  return typeof sessionId === 'string' && isSpot(spot) && barrierOpened === true;
}

function isSpot(candidate: unknown): candidate is AssignedSpot {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const { number, levelCode, aisleCode } = candidate as Record<string, unknown>;
  return typeof number === 'string' && typeof levelCode === 'string' && typeof aisleCode === 'string';
}
