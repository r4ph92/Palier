import type { GeoPosition } from '@palier/shared-types';
import type { DeviceLocationClient, LocationPermission } from './DeviceLocationClient';

export type DriverLocation =
  | { readonly status: 'located'; readonly position: GeoPosition }
  | { readonly status: 'denied' }
  | { readonly status: 'unavailable' };

const DENIED: DriverLocation = { status: 'denied' };
const UNAVAILABLE: DriverLocation = { status: 'unavailable' };

// A failure never blocks the list: a refused or failed permission counts as denied, a failed read as unavailable.
export async function locateDriver(client: DeviceLocationClient): Promise<DriverLocation> {
  const permission = await client.requestWhileInUse().catch((): LocationPermission => 'denied');
  if (permission === 'denied') {
    return DENIED;
  }
  const position = await client.currentPosition().catch(() => null);
  return position === null ? UNAVAILABLE : { status: 'located', position };
}

export function positionOf(location: DriverLocation): GeoPosition | null {
  return location.status === 'located' ? location.position : null;
}
