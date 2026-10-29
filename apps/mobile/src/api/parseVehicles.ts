import type { Vehicle, VehicleListResponse } from '@palier/shared-types';
import { PalierUnreachableError } from './LotsClient';

export function parseVehicleList(body: unknown): VehicleListResponse {
  if (!Array.isArray(body) || !body.every(isVehicle)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

export function parseVehicle(body: unknown): Vehicle {
  if (!isVehicle(body)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

function isVehicle(candidate: unknown): candidate is Vehicle {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const { id, plate, province } = candidate as Record<string, unknown>;
  return typeof id === 'string' && typeof plate === 'string' && typeof province === 'string';
}
