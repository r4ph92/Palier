import type { GeoPosition } from '@palier/shared-types';
import { isOnEarth } from '@palier/shared-types/lots';
import type { DeviceLocationClient, LocationPermission } from './DeviceLocationClient';

export type DriverLocation =
  | { readonly status: 'located'; readonly position: GeoPosition }
  | { readonly status: 'denied' }
  | { readonly status: 'unavailable' };

const DENIED: DriverLocation = { status: 'denied' };
const UNAVAILABLE: DriverLocation = { status: 'unavailable' };

// A refused or failed permission counts as denied and a failed read as unavailable, so the list still shows in name order.
export async function locateDriver(client: DeviceLocationClient): Promise<DriverLocation> {
  const permission = await client.requestWhileInUse().catch((error: unknown): LocationPermission => {
    console.warn('Location permission request failed; lots are sorted by name', error);
    return 'denied';
  });
  if (permission === 'denied') {
    return DENIED;
  }
  const position = await client.currentPosition().catch((error: unknown) => {
    console.warn('Reading the device position failed; lots are sorted by name', error);
    return null;
  });
  return position === null || !isOnEarth(position) ? UNAVAILABLE : { status: 'located', position };
}

export function positionOf(location: DriverLocation): GeoPosition | null {
  return location.status === 'located' ? location.position : null;
}
