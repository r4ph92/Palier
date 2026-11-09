import type { ExitResponse } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { isInstant } from './isInstant';
import { isNonNegativeInteger } from './isNonNegativeInteger';
import { PalierUnreachableError } from './LotsClient';

export function parseExit(body: unknown): ExitResponse {
  const { exitedAt, durationMinutes, increments, incrementCents, totalCents, capped } = asRecord(asRecord(body)['receipt']);
  if (
    !isInstant(exitedAt) ||
    !isNonNegativeInteger(durationMinutes) ||
    !isNonNegativeInteger(increments) ||
    !isNonNegativeInteger(incrementCents) ||
    !isNonNegativeInteger(totalCents) ||
    typeof capped !== 'boolean'
  ) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { receipt: { exitedAt, durationMinutes, increments, incrementCents, totalCents, capped } };
}
