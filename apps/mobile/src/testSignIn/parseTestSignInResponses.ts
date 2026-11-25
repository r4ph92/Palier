import type { TestDriver, TestDriverListResponse } from '@palier/shared-types';
import { PalierUnreachableError } from '../api/LotsClient';
import { asRecord } from '../api/asRecord';
import { isDriverProfile } from '../api/parseDriverResponses';

export function parseTestDrivers(body: unknown): TestDriverListResponse {
  if (!Array.isArray(body) || !body.every(isTestDriver)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

function isTestDriver(candidate: unknown): candidate is TestDriver {
  return isDriverProfile(candidate) && typeof asRecord(candidate).lastName === 'string';
}
