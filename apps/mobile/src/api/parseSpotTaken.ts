import type { SpotTakenResponse } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { PalierUnreachableError } from './LotsClient';
import { isSpot } from './parseEntry';

export function parseSpotTaken(body: unknown): SpotTakenResponse {
  const { outcome, spot } = asRecord(body);
  if (outcome === 'none-free') {
    return { outcome };
  }
  if (outcome !== 'reassigned' || !isSpot(spot)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { outcome, spot };
}
