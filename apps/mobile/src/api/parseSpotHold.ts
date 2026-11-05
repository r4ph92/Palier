import type { SpotHold } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { isInstant } from './isInstant';
import { PalierUnreachableError } from './LotsClient';

export function parseSpotHold(body: unknown): SpotHold {
  if (!isSpotHold(body)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  const { spotHoldId, lotId, lotName, expiresAt, now } = body;
  return { spotHoldId, lotId, lotName, expiresAt, now };
}

export function parseCurrentSpotHold(body: unknown): SpotHold | null {
  const { spotHold } = asRecord(body);
  return spotHold === null ? null : parseSpotHold(spotHold);
}

function isSpotHold(candidate: unknown): candidate is SpotHold {
  const { spotHoldId, lotId, lotName, expiresAt, now } = asRecord(candidate);
  return typeof spotHoldId === 'string' && typeof lotId === 'string' && typeof lotName === 'string' && isInstant(expiresAt) && isInstant(now);
}
