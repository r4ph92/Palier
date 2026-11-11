import type { Vehicle, VehicleNeeds } from '@palier/shared-types';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError, type VehicleClient } from '../api/VehicleClient';
import type { VehicleNeed } from './vehicleNeeds';
import { useVehicleNeeds } from './useVehicleNeeds';

export interface EditVehicleController {
  readonly needs: VehicleNeeds;
  readonly transponder: string;
  readonly isTransponderInvalid: boolean;
  readonly hasFailed: boolean;
  readonly isSaving: boolean;
  setTransponder(transponder: string): void;
  toggleNeed(need: VehicleNeed): void;
  save(): void;
}

export function useEditVehicle(client: VehicleClient, vehicle: Vehicle, onSaved: () => void): EditVehicleController {
  const { needs, toggleNeed } = useVehicleNeeds(needsOf(vehicle));
  const field = useTransponderField(vehicle.transponder ?? '');
  const [hasFailed, setHasFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { transponder, setIsTransponderInvalid } = field;
  const save = useCallback(async () => {
    setHasFailed(false);
    setIsTransponderInvalid(false);
    setIsSaving(true);
    try {
      await client.updateVehicleNeeds(vehicle.id, { ...needs, transponder });
      onSaved();
    } catch (error) {
      setIsSaving(false);
      settleFailure(error, { setHasFailed, setIsTransponderInvalid });
    }
  }, [client, vehicle.id, needs, transponder, setIsTransponderInvalid, onSaved]);
  return { needs, transponder, isTransponderInvalid: field.isTransponderInvalid, hasFailed, isSaving, setTransponder: field.setTransponder, toggleNeed, save };
}

function needsOf({ isElectric, hasAccessiblePermit, isOversize }: Vehicle): VehicleNeeds {
  return { isElectric, hasAccessiblePermit, isOversize };
}

// Shown upper-case as it is typed, so the field matches the identifier Palier stores.
function useTransponderField(initial: string) {
  const [transponder, setTransponderValue] = useState(initial);
  const setTransponder = useCallback((value: string) => setTransponderValue(value.toUpperCase()), []);
  const [isTransponderInvalid, setIsTransponderInvalid] = useState(false);
  return { transponder, setTransponder, isTransponderInvalid, setIsTransponderInvalid };
}

interface FailureSetters {
  readonly setHasFailed: Dispatch<SetStateAction<boolean>>;
  readonly setIsTransponderInvalid: Dispatch<SetStateAction<boolean>>;
}

// A refused session or a missing notice already moves the app off this screen, so nothing is shown here.
// Any other error is re-raised from a state updater, so the error boundary sees it.
function settleFailure(error: unknown, { setHasFailed, setIsTransponderInvalid }: FailureSetters): void {
  if (error instanceof PalierRejectedError && error.code === 'INVALID_TRANSPONDER') {
    setIsTransponderInvalid(true);
    return;
  }
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
