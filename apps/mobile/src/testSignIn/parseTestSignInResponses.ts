import type { SignInResponse, TestDriver, TestDriverListResponse } from '@palier/shared-types';
import { PalierUnreachableError } from '../api/LotsClient';
import { asRecord } from '../api/asRecord';
import { isDriverProfile } from '../api/parseDriverResponses';

export function parseSignInResponse(body: unknown): SignInResponse {
  const { token, driver } = asRecord(body);
  if (typeof token !== 'string' || !isDriverProfile(driver)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { token, driver };
}

export function parseTestDrivers(body: unknown): TestDriverListResponse {
  if (!Array.isArray(body) || !body.every(isTestDriver)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

function isTestDriver(candidate: unknown): candidate is TestDriver {
  return isDriverProfile(candidate) && typeof asRecord(candidate).lastName === 'string';
}
