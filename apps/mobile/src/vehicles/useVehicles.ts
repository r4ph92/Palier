import type { Vehicle } from '@palier/shared-types';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError, type VehicleClient } from '../api/VehicleClient';

export type VehiclesState = { readonly status: 'loading' } | { readonly status: 'loaded'; readonly vehicles: readonly Vehicle[] } | { readonly status: 'error' };

export type VehicleActionError = 'last-vehicle' | 'failed';

export interface VehiclesController {
  readonly state: VehiclesState;
  readonly actionError: VehicleActionError | null;
  reload(): void;
  chooseDefault(vehicle: Vehicle): void;
  remove(vehicle: Vehicle): void;
}

export function useVehicles(client: VehicleClient): VehiclesController {
  const { state, showVehicles, reload } = useVehicleList(client);
  const [actionError, setActionError] = useState<VehicleActionError | null>(null);
  // The list is read again after a change, so the screen always shows what Palier stored.
  const runAction = useCallback(
    (action: () => Promise<unknown>) => {
      setActionError(null);
      action()
        .then(() => client.listVehicles())
        .then(showVehicles, (error: unknown) => settleActionFailure(error, setActionError));
    },
    [client, showVehicles],
  );
  const chooseDefault = useCallback((vehicle: Vehicle) => runAction(() => client.setDefaultVehicle(vehicle.id)), [client, runAction]);
  const remove = useCallback((vehicle: Vehicle) => runAction(() => client.deleteVehicle(vehicle.id)), [client, runAction]);
  return { state, actionError, reload, chooseDefault, remove };
}

function useVehicleList(client: VehicleClient) {
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
  const showVehicles = useCallback((vehicles: readonly Vehicle[]) => setState({ status: 'loaded', vehicles }), []);
  return { state, showVehicles, reload };
}

function settleActionFailure(error: unknown, setActionError: Dispatch<SetStateAction<VehicleActionError | null>>): void {
  if (error instanceof PalierRejectedError && error.code === 'LAST_VEHICLE') {
    setActionError('last-vehicle');
    return;
  }
  if (error instanceof PalierRejectedError || error instanceof PalierUnreachableError) {
    setActionError('failed');
    return;
  }
  if (error instanceof PalierConsentRequiredError || error instanceof PalierUnauthorizedError) {
    return;
  }
  setActionError(() => {
    throw error;
  });
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
