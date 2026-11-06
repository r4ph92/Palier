import type { GeoPosition } from '@palier/shared-types';
import * as Location from 'expo-location';
import type { BackgroundLocationClient, BackgroundLocationStatus } from './BackgroundLocationClient';
import type { DeviceLocationClient, LocationPermission } from './DeviceLocationClient';

export const LAST_KNOWN_POSITION_MAX_AGE_MILLISECONDS = 60_000;
export const CURRENT_POSITION_TIMEOUT_MILLISECONDS = 5_000;

export class ExpoDeviceLocationClient implements DeviceLocationClient, BackgroundLocationClient {
  async requestWhileInUse(): Promise<LocationPermission> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED ? 'granted' : 'denied';
  }

  // iOS turns this into the « Always » upgrade prompt, and answers at once when the foreground permission is refused.
  async requestAlways(): Promise<void> {
    await Location.requestBackgroundPermissionsAsync();
  }

  async backgroundStatus(): Promise<BackgroundLocationStatus> {
    const background = await Location.getBackgroundPermissionsAsync();
    if (background.status === Location.PermissionStatus.GRANTED) {
      return 'always';
    }
    const foreground = await Location.getForegroundPermissionsAsync();
    return foreground.status === Location.PermissionStatus.GRANTED ? 'limited' : 'denied';
  }

  async currentPosition(): Promise<GeoPosition | null> {
    const location =
      (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_POSITION_MAX_AGE_MILLISECONDS })) ?? (await freshPositionOrNull());
    return location === null ? null : { latitude: location.coords.latitude, longitude: location.coords.longitude };
  }
}

// A basement can keep the GPS searching for minutes; the list falls back to name order rather than wait.
function freshPositionOrNull(): Promise<Location.LocationObject | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timeout = setTimeout(() => resolve(null), CURRENT_POSITION_TIMEOUT_MILLISECONDS);
  });
  const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return Promise.race([fresh, timedOut]).finally(() => clearTimeout(timeout));
}
