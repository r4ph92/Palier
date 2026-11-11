// Declared by the driver; the permit is not checked (D2).
export interface VehicleNeeds {
  readonly isElectric: boolean;
  readonly hasAccessiblePermit: boolean;
  readonly isOversize: boolean;
}

export interface Vehicle extends VehicleNeeds {
  readonly id: string;
  readonly plate: string;
  readonly province: string;
  readonly isDefault: boolean;
  // The identifier of the driver's exit transponder; null when none.
  readonly transponder: string | null;
}

export type VehicleListResponse = readonly Vehicle[];
