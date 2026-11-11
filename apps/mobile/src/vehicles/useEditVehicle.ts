import type { Vehicle, VehicleNeeds } from '@palier/shared-types';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError, type VehicleClient } from '../api/VehicleClient';
import type { VehicleNeed } from './vehicleNeeds';
import { useVehicleNeeds } from './useVehicleNeeds';

export type TransponderError = 'invalid' | 'taken';

const TRANSPONDER_ERROR_BY_CODE: Readonly<Record<string, TransponderError>> = { INVALID_TRANSPONDER: 'invalid', TRANSPONDER_ALREADY_REGISTERED: 'taken' };

export interface EditVehicleController {
  readonly needs: VehicleNeeds;
  readonly transponder: string;
  // Why Palier refused the transponder, when it did.
  readonly transponderError: TransponderError | null;
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
  const { transponder, setTransponderError } = field;
  const save = useCallback(async () => {
    setHasFailed(false);
    setTransponderError(null);
    setIsSaving(true);
    try {
      await client.updateVehicleNeeds(vehicle.id, { ...needs, transponder });
      onSaved();
    } catch (error) {
      setIsSaving(false);
      settleFailure(error, { setHasFailed, setTransponderError });
    }
  }, [client, vehicle.id, needs, transponder, setTransponderError, onSaved]);
  return { needs, transponder, transponderError: field.transponderError, hasFailed, isSaving, setTransponder: field.setTransponder, toggleNeed, save };
}

function needsOf({ isElectric, hasAccessiblePermit, isOversize }: Vehicle): VehicleNeeds {
  return { isElectric, hasAccessiblePermit, isOversize };
}

// Shown upper-case as it is typed, so the field matches the identifier Palier stores.
function useTransponderField(initial: string) {
  const [transponder, setTransponderValue] = useState(initial);
  const setTransponder = useCallback((value: string) => setTransponderValue(value.toUpperCase()), []);
  const [transponderError, setTransponderError] = useState<TransponderError | null>(null);
  return { transponder, setTransponder, transponderError, setTransponderError };
}

interface FailureSetters {
  readonly setHasFailed: Dispatch<SetStateAction<boolean>>;
  readonly setTransponderError: Dispatch<SetStateAction<TransponderError | null>>;
}

// A refused session or a missing notice already moves the app off this screen, so nothing is shown here.
// Any other error is re-raised from a state updater, so the error boundary sees it.
function settleFailure(error: unknown, { setHasFailed, setTransponderError }: FailureSetters): void {
  const transponderError = error instanceof PalierRejectedError ? TRANSPONDER_ERROR_BY_CODE[error.code] : undefined;
  if (transponderError !== undefined) {
    setTransponderError(transponderError);
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
