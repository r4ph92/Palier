import type { ParkedPresumptionResponse } from '@palier/shared-types';
import { isInstant } from './isInstant';
import { PalierUnreachableError } from './LotsClient';

export function parseParkedPresumption(body: unknown): ParkedPresumptionResponse {
  const { state, parkedAt } = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (state !== 'PARKED_PRESUMED' || !isInstant(parkedAt)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { state, parkedAt };
}
