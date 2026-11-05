import type { GeoPosition } from '@palier/shared-types';
import type { DeviceLocationClient, LocationPermission } from '../src/deviceLocation/DeviceLocationClient';

// The custom location the README gives the Simulator: 350 m north of Parking Démo.
export const SIMULATOR_POSITION: GeoPosition = { latitude: 45.5048, longitude: -73.5673 };

type FakePermission = LocationPermission | 'failing' | 'pending';

export class FakeDeviceLocationClient implements DeviceLocationClient {
  readonly #permission: FakePermission;
  readonly #position: GeoPosition | null;
  permissionRequests = 0;
  positionReads = 0;

  constructor(permission: FakePermission = 'granted', position: GeoPosition | null = SIMULATOR_POSITION) {
    this.#permission = permission;
    this.#position = position;
  }

  requestWhileInUse(): Promise<LocationPermission> {
    this.permissionRequests += 1;
    if (this.#permission === 'pending') {
      return new Promise<LocationPermission>(() => undefined);
    }
    if (this.#permission === 'failing') {
      return Promise.reject(new Error('fake permission failure'));
    }
    return Promise.resolve(this.#permission);
  }

  currentPosition(): Promise<GeoPosition | null> {
    this.positionReads += 1;
    return Promise.resolve(this.#position);
  }
}
