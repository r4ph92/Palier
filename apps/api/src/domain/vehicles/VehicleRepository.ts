import type { PlateEntry } from './plate.ts';

export interface Vehicle {
  readonly id: string;
  readonly plate: string;
  readonly province: string;
  readonly isDefault: boolean;
}

export interface NewVehicle extends PlateEntry {
  readonly province: string;
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
  setDefaultVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null>;
  // When the default vehicle goes, another vehicle of this driver becomes the default.
  deleteVehicle(driverId: string, vehicleId: string): Promise<DeleteVehicleResult>;
}
