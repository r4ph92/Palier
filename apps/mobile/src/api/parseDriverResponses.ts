import type { CurrentDriver, DriverProfile } from '@palier/shared-types';
import { PalierUnreachableError } from './LotsClient';
import { asRecord } from './asRecord';

export function parseDriverProfile(body: unknown): DriverProfile {
  if (!isDriverProfile(body)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

export function parseCurrentDriver(body: unknown): CurrentDriver {
  const profile = parseDriverProfile(body);
  const { acceptedNoticeVersion } = asRecord(body);
  if (typeof acceptedNoticeVersion === 'string' || acceptedNoticeVersion === null) {
    return { ...profile, acceptedNoticeVersion };
  }
  throw new PalierUnreachableError('unexpected response body');
}

export function isDriverProfile(candidate: unknown): candidate is DriverProfile {
  const { id, firstName } = asRecord(candidate);
  return typeof id === 'string' && typeof firstName === 'string';
}
