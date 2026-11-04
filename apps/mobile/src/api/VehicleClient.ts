import type { Vehicle, VehicleListResponse } from '@palier/shared-types';

export interface NewVehicleInput {
  readonly plate: string;
  readonly province: string;
}

export interface VehicleClient {
  listVehicles(): Promise<VehicleListResponse>;
  addVehicle(vehicle: NewVehicleInput): Promise<Vehicle>;
  setDefaultVehicle(vehicleId: string): Promise<Vehicle>;
  deleteVehicle(vehicleId: string): Promise<void>;
}

// The API refused the request with a reason the driver can fix, such as an invalid plate or a duplicate.
export class PalierRejectedError extends Error {
  readonly code: string;
  // The hold a declined card refused, when the API names it.
  readonly authorizedCents: number | null;

  constructor(code: string, authorizedCents: number | null = null) {
    super(`Palier rejected the request: ${code}`);
    this.name = 'PalierRejectedError';
    this.code = code;
    this.authorizedCents = authorizedCents;
  }
}

export class PalierConsentRequiredError extends Error {
  constructor() {
    super('Palier requires the current privacy notice');
    this.name = 'PalierConsentRequiredError';
  }
}
