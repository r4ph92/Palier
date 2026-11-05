import type { GeoPosition } from '@palier/shared-types';

export type LocationPermission = 'granted' | 'denied';

export interface DeviceLocationClient {
  requestWhileInUse(): Promise<LocationPermission>;
  currentPosition(): Promise<GeoPosition | null>;
}
