import type { TariffPolicy, Vehicle, VehicleListResponse, VehicleNeeds } from '@palier/shared-types';

export interface NewVehicleInput extends VehicleNeeds {
  readonly plate: string;
  readonly province: string;
}

// The needs and the exit transponder as typed; an empty transponder clears it.
export interface VehicleEdit extends VehicleNeeds {
  readonly transponder: string;
}

export interface VehicleClient {
  listVehicles(): Promise<VehicleListResponse>;
  addVehicle(vehicle: NewVehicleInput): Promise<Vehicle>;
  updateVehicleNeeds(vehicleId: string, edit: VehicleEdit): Promise<Vehicle>;
  setDefaultVehicle(vehicleId: string): Promise<Vehicle>;
  deleteVehicle(vehicleId: string): Promise<void>;
}

// The API refused the request with a reason the driver can fix, such as an invalid plate or a duplicate.
export class PalierRejectedError extends Error {
  readonly code: string;
  // The hold a declined card refused, when the API names it.
  readonly authorizedCents: number | null;
  // TARIFF_CHANGED: the lot's current tariff, when the API names it.
  readonly tariff: TariffPolicy | null;

  constructor(code: string, authorizedCents: number | null = null, tariff: TariffPolicy | null = null) {
    super(`Palier rejected the request: ${code}`);
    this.name = 'PalierRejectedError';
    this.code = code;
    this.authorizedCents = authorizedCents;
    this.tariff = tariff;
  }
}

export class PalierConsentRequiredError extends Error {
  constructor() {
    super('Palier requires the current privacy notice');
    this.name = 'PalierConsentRequiredError';
  }
}
