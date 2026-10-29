import type { Vehicle, VehicleListResponse } from '@palier/shared-types';
import { PalierUnreachableError } from '../src/api/LotsClient';
import type { NewVehicleInput, VehicleClient } from '../src/api/VehicleClient';

export const abc123: Vehicle = { id: 'vehicle-1', plate: 'ABC 123', province: 'QC' };

export class FakeVehicleClient implements VehicleClient {
  readonly #vehicles: Vehicle[];
  isReachable = true;

  constructor(vehicles: readonly Vehicle[] = []) {
    this.#vehicles = [...vehicles];
  }

  get savedVehicles(): readonly Vehicle[] {
    return this.#vehicles;
  }

  listVehicles(): Promise<VehicleListResponse> {
    return this.isReachable ? Promise.resolve([...this.#vehicles]) : Promise.reject(new PalierUnreachableError('fake'));
  }

  addVehicle({ plate, province }: NewVehicleInput): Promise<Vehicle> {
    const vehicle = { id: `vehicle-${this.#vehicles.length + 1}`, plate: plate.trim().toUpperCase(), province };
    this.#vehicles.push(vehicle);
    return Promise.resolve(vehicle);
  }
}
