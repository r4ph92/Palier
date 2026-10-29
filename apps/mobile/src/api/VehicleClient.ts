import type { Vehicle, VehicleListResponse } from '@palier/shared-types';

export interface NewVehicleInput {
  readonly plate: string;
  readonly province: string;
}

export interface VehicleClient {
  listVehicles(): Promise<VehicleListResponse>;
  addVehicle(vehicle: NewVehicleInput): Promise<Vehicle>;
}

// The API refused the request with a reason the driver can fix, such as an invalid plate or a duplicate.
export class PalierRejectedError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Palier rejected the request: ${code}`);
    this.name = 'PalierRejectedError';
    this.code = code;
  }
}

export class PalierConsentRequiredError extends Error {
  constructor() {
    super('Palier requires the current privacy notice');
    this.name = 'PalierConsentRequiredError';
  }
}
