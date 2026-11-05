import type { GeoPosition } from '@palier/shared-types';
import type { DeviceLocationClient, LocationPermission } from '../src/deviceLocation/DeviceLocationClient';

// The custom location the README gives the Simulator: 350 m north of Parking Démo.
export const SIMULATOR_POSITION: GeoPosition = { latitude: 45.5048, longitude: -73.5673 };

export const LOCATION_DENIED_NOTICE_FR = 'Activez la localisation pour trier par distance';

type FakePermission = LocationPermission | 'failing' | 'pending';

export class FakeDeviceLocationClient implements DeviceLocationClient {
  readonly #permission: FakePermission;
  readonly #position: GeoPosition | null;
  #answerPrompt: (permission: LocationPermission) => void = () => undefined;
  permissionRequests = 0;
  positionReads = 0;

  constructor(permission: FakePermission = 'granted', position: GeoPosition | null = SIMULATOR_POSITION) {
    this.#permission = permission;
    this.#position = position;
  }

  requestWhileInUse(): Promise<LocationPermission> {
    this.permissionRequests += 1;
    if (this.#permission === 'pending') {
      return new Promise<LocationPermission>((resolve) => {
        this.#answerPrompt = resolve;
      });
    }
    if (this.#permission === 'failing') {
      return Promise.reject(new Error('fake permission failure'));
    }
    return Promise.resolve(this.#permission);
  }

  // Answers a 'pending' prompt, as the driver would after a while.
  answerPrompt(permission: LocationPermission): void {
    this.#answerPrompt(permission);
  }

  currentPosition(): Promise<GeoPosition | null> {
    this.positionReads += 1;
    return Promise.resolve(this.#position);
  }
}
