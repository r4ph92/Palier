import type { Vehicle, VehicleNeeds } from '@palier/shared-types';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, type VehicleClient } from '../api/VehicleClient';
import type { VehicleNeed } from './vehicleNeeds';
import { useVehicleNeeds } from './useVehicleNeeds';

export interface EditVehicleController {
  readonly needs: VehicleNeeds;
  readonly hasFailed: boolean;
  toggleNeed(need: VehicleNeed): void;
  save(): void;
}

export function useEditVehicle(client: VehicleClient, vehicle: Vehicle, onSaved: () => void): EditVehicleController {
  const { isElectric, hasAccessiblePermit, isOversize } = vehicle;
  const { needs, toggleNeed } = useVehicleNeeds({ isElectric, hasAccessiblePermit, isOversize });
  const [hasFailed, setHasFailed] = useState(false);
  const save = useCallback(async () => {
    setHasFailed(false);
    try {
      await client.updateVehicleNeeds(vehicle.id, needs);
      onSaved();
    } catch (error) {
      settleFailure(error, setHasFailed);
    }
  }, [client, vehicle.id, needs, onSaved]);
  return { needs, hasFailed, toggleNeed, save };
}

// A refused session or a missing notice already moves the app off this screen, so nothing is shown here.
// Any other error is re-raised from a state updater, so the error boundary sees it.
function settleFailure(error: unknown, setHasFailed: Dispatch<SetStateAction<boolean>>): void {
  if (error instanceof PalierConsentRequiredError || error instanceof PalierUnauthorizedError) {
    return;
  }
  if (error instanceof PalierUnreachableError) {
    setHasFailed(true);
    return;
  }
  setHasFailed(() => {
    throw error;
  });
}
