import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { BackgroundLocationClient, BackgroundLocationStatus } from './BackgroundLocationClient';

// Null until iOS answers; read again when the app returns to the front, since the driver may have changed it in Settings.
export function useBackgroundLocationStatus(client: BackgroundLocationClient): BackgroundLocationStatus | null {
  const [status, setStatus] = useState<BackgroundLocationStatus | null>(null);
  useEffect(() => {
    let isCurrent = true;
    const read = () => {
      client
        .backgroundStatus()
        .then((answer) => isCurrent && setStatus(answer))
        .catch((error: unknown) => console.warn('Reading the « Always » location permission failed', error));
    };
    read();
    const subscription = AppState.addEventListener('change', (next) => next === 'active' && read());
    return () => {
      isCurrent = false;
      subscription.remove();
    };
  }, [client]);
  return status;
}
