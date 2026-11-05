import type { GeoPosition } from '@palier/shared-types';

export type LocationPermission = 'granted' | 'denied';

// The position is read on the device to sort the lots and is never sent to Palier.
export interface DeviceLocationClient {
  requestWhileInUse(): Promise<LocationPermission>;
  currentPosition(): Promise<GeoPosition | null>;
}
