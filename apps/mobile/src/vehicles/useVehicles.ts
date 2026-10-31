import type { Vehicle } from '@palier/shared-types';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, type VehicleClient } from '../api/VehicleClient';

export type VehiclesState = { readonly status: 'loading' } | { readonly status: 'loaded'; readonly vehicles: readonly Vehicle[] } | { readonly status: 'error' };

export interface VehiclesController {
  readonly state: VehiclesState;
  reload(): void;
}

export function useVehicles(client: VehicleClient): VehiclesController {
  const [state, setState] = useState<VehiclesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // An error rejected in an async callback bypasses error boundaries; throwing from a state updater re-raises it during render.
  useEffect(() => {
    let isLatestAttempt = true;
    client.listVehicles().then(
      (vehicles) => isLatestAttempt && setState({ status: 'loaded', vehicles }),
      (error: unknown) => isLatestAttempt && settleFailure(error, setState),
    );
    return () => {
      isLatestAttempt = false;
    };
  }, [client, attempt]);
  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((previous) => previous + 1);
  }, []);
  return { state, reload };
}

// A refused session or a missing notice already moves the app off this screen, so there is nothing to show here.
function settleFailure(error: unknown, setState: Dispatch<SetStateAction<VehiclesState>>): void {
  if (error instanceof PalierUnreachableError) {
    setState({ status: 'error' });
    return;
  }
  if (error instanceof PalierConsentRequiredError || error instanceof PalierUnauthorizedError) {
    return;
  }
  setState(() => {
    throw error;
  });
}
