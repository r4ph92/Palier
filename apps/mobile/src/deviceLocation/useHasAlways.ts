import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { BackgroundLocationClient } from './BackgroundLocationClient';

// Null until iOS answers; read again when the app returns to the front, since the driver may have changed it in Settings.
export function useHasAlways(client: BackgroundLocationClient): boolean | null {
  const [hasAlways, setHasAlways] = useState<boolean | null>(null);
  useEffect(() => watchHasAlways(client, setHasAlways), [client]);
  return hasAlways;
}

function watchHasAlways(client: BackgroundLocationClient, onAnswer: (hasAlways: boolean) => void): () => void {
  let isCurrent = true;
  const read = () =>
    readHasAlways(client, (answer) => {
      if (isCurrent) {
        onAnswer(answer);
      }
    });
  read();
  const subscription = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      read();
    }
  });
  return () => {
    isCurrent = false;
    subscription.remove();
  };
}

function readHasAlways(client: BackgroundLocationClient, onAnswer: (hasAlways: boolean) => void): void {
  client
    .hasAlways()
    .then(onAnswer)
    .catch((error: unknown) => console.warn('Reading the « Always » location permission failed', error));
}
