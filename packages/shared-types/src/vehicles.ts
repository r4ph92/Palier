export interface Vehicle {
  readonly id: string;
  readonly plate: string;
  readonly province: string;
  readonly isDefault: boolean;
}

export type VehicleListResponse = readonly Vehicle[];
