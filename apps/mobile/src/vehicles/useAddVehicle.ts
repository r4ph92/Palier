import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError, type NewVehicleInput, type VehicleClient } from '../api/VehicleClient';
import { i18n } from '../i18n/i18n';

export interface AddVehicleErrors {
  readonly plate?: string | undefined;
  readonly province?: string | undefined;
  readonly form?: string | undefined;
}

export interface AddVehicleController {
  readonly plate: string;
  readonly province: string | null;
  readonly errors: AddVehicleErrors;
  setPlate(plate: string): void;
  setProvince(province: string): void;
  save(): void;
}

export function useAddVehicle(client: VehicleClient, onSaved: () => void): AddVehicleController {
  const [plate, setPlateValue] = useState('');
  // Shown upper-case as it is typed, so the field matches the plate Palier stores.
  const setPlate = useCallback((value: string) => setPlateValue(value.toUpperCase()), []);
  const [province, setProvince] = useState<string | null>(null);
  const [errors, setErrors] = useState<AddVehicleErrors>({});
  // A province message is about the choice that was missing, so it goes once a province is chosen.
  const chooseProvince = useCallback((code: string) => {
    setProvince(code);
    setErrors((previous) => ({ ...previous, province: undefined }));
  }, []);
  const save = useCallback(async () => {
    if (province === null) {
      setErrors({ province: i18n.t('vehicles.invalidProvince') });
      return;
    }
    setErrors({});
    await submitVehicle(client, { plate, province }, { onSaved, setErrors });
  }, [client, plate, province, onSaved]);
  return { plate, province, errors, setPlate, setProvince: chooseProvince, save };
}

interface SubmitHandlers {
  readonly onSaved: () => void;
  readonly setErrors: Dispatch<SetStateAction<AddVehicleErrors>>;
}

async function submitVehicle(client: VehicleClient, input: NewVehicleInput, { onSaved, setErrors }: SubmitHandlers): Promise<void> {
  try {
    await client.addVehicle(input);
    onSaved();
  } catch (error) {
    settleFailure(error, setErrors);
  }
}

// A refused session or a missing notice already moves the app off this screen, so nothing is shown here.
function settleFailure(error: unknown, setErrors: Dispatch<SetStateAction<AddVehicleErrors>>): void {
  if (error instanceof PalierRejectedError) {
    setErrors(errorsFor(error.code));
    return;
  }
  if (error instanceof PalierUnreachableError) {
    setErrors({ form: i18n.t('vehicles.saveFailed') });
    return;
  }
  if (error instanceof PalierConsentRequiredError || error instanceof PalierUnauthorizedError) {
    return;
  }
  setErrors(() => {
    throw error;
  });
}

function errorsFor(code: string): AddVehicleErrors {
  switch (code) {
    case 'INVALID_PLATE':
      return { plate: i18n.t('vehicles.invalidPlate') };
    case 'INVALID_PROVINCE':
      return { province: i18n.t('vehicles.invalidProvince') };
    case 'VEHICLE_ALREADY_REGISTERED':
      return { form: i18n.t('vehicles.duplicate') };
    default:
      return { form: i18n.t('vehicles.saveFailed') };
  }
}
