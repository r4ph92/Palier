export interface Vehicle {
  readonly id: string;
  readonly plate: string;
  readonly province: string;
}

export type VehicleListResponse = readonly Vehicle[];
