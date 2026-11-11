import type { PlateEntry, TransponderEntry } from './plate.ts';

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
  // The identifier of the driver's exit transponder, as typed in upper case; null when none.
  readonly transponder: string | null;
}

export interface NewVehicle extends PlateEntry, VehicleNeeds {
  readonly province: string;
}

// What an edit changes: the needs, and the transponder when given (null clears it, undefined keeps it).
export interface VehicleEdit extends VehicleNeeds {
  readonly transponder?: TransponderEntry | null;
}

// A driver always keeps one vehicle, so the last one cannot be deleted.
export type DeleteVehicleResult = 'deleted' | 'not-found' | 'last-vehicle';

export interface VehicleRepository {
  listVehicles(driverId: string): Promise<readonly Vehicle[]>;
  findVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null>;
  findDefaultVehicle(driverId: string): Promise<Vehicle | null>;
  // Resolves to null when this driver already has the plate in that province.
  saveVehicle(driverId: string, vehicle: NewVehicle): Promise<Vehicle | null>;
  // Resolves to null when this driver has no such vehicle.
  updateVehicleNeeds(driverId: string, vehicleId: string, edit: VehicleEdit): Promise<Vehicle | null>;
  // Resolves to null when this driver has no such vehicle.
  setDefaultVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null>;
  // When the default vehicle goes, another vehicle of this driver becomes the default.
  deleteVehicle(driverId: string, vehicleId: string): Promise<DeleteVehicleResult>;
}
