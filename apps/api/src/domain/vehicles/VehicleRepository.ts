import type { PlateEntry } from './plate.ts';

export interface Vehicle {
  readonly id: string;
  readonly plate: string;
  readonly province: string;
}

export interface NewVehicle extends PlateEntry {
  readonly province: string;
}

export interface VehicleRepository {
  listVehicles(driverId: string): Promise<readonly Vehicle[]>;
  findVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null>;
  // Resolves to null when this driver already has the plate in that province.
  saveVehicle(driverId: string, vehicle: NewVehicle): Promise<Vehicle | null>;
}
