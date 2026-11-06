import type { GeoPosition } from '@palier/shared-types';
import * as Location from 'expo-location';
import type { BackgroundLocationClient } from './BackgroundLocationClient';
import type { DeviceLocationClient, LocationPermission } from './DeviceLocationClient';

export const LAST_KNOWN_POSITION_MAX_AGE_MILLISECONDS = 60_000;
export const CURRENT_POSITION_TIMEOUT_MILLISECONDS = 5_000;
export const ALWAYS_REQUEST_TIMEOUT_MILLISECONDS = 30_000;

export class ExpoDeviceLocationClient implements DeviceLocationClient, BackgroundLocationClient {
  async requestWhileInUse(): Promise<LocationPermission> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED ? 'granted' : 'denied';
  }

  // iOS turns this into the « Always » upgrade prompt; when it shows no prompt it may never answer, so the driver is not kept waiting.
  async requestAlways(): Promise<void> {
    await withTimeout(Location.requestBackgroundPermissionsAsync(), ALWAYS_REQUEST_TIMEOUT_MILLISECONDS);
  }

  async hasAlways(): Promise<boolean> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  }

  async currentPosition(): Promise<GeoPosition | null> {
    const location =
      (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_POSITION_MAX_AGE_MILLISECONDS })) ?? (await freshPositionOrNull());
    return location === null ? null : { latitude: location.coords.latitude, longitude: location.coords.longitude };
  }
}

// A basement can keep the GPS searching for minutes; the list falls back to name order rather than wait.
function freshPositionOrNull(): Promise<Location.LocationObject | null> {
  return withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), CURRENT_POSITION_TIMEOUT_MILLISECONDS);
}

function withTimeout<T>(pending: Promise<T>, milliseconds: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timeout = setTimeout(() => resolve(null), milliseconds);
  });
  return Promise.race([pending, timedOut]).finally(() => clearTimeout(timeout));
}
