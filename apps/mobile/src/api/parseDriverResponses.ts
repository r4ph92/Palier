import type { CurrentDriver, DriverProfile, SignInResponse, TestDriver, TestDriverListResponse } from '@palier/shared-types';
import { PalierUnreachableError } from './LotsClient';

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

function isDriverProfile(candidate: unknown): candidate is DriverProfile {
  const { id, firstName } = asRecord(candidate);
  return typeof id === 'string' && typeof firstName === 'string';
}

function isTestDriver(candidate: unknown): candidate is TestDriver {
  return isDriverProfile(candidate) && typeof asRecord(candidate).lastName === 'string';
}

function asRecord(candidate: unknown): Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null ? (candidate as Record<string, unknown>) : {};
}
