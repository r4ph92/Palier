import type { Vehicle, VehicleListResponse, VehicleNeeds } from '@palier/shared-types';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError, type NewVehicleInput, type VehicleClient } from '../src/api/VehicleClient';

export const standardNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };

export const abc123: Vehicle = { id: 'vehicle-1', plate: 'ABC 123', province: 'QC', isDefault: true, ...standardNeeds };

export class FakeVehicleClient implements VehicleClient {
  readonly #vehicles: Vehicle[];
  isReachable = true;
  nextRejection: string | null = null;

  constructor(vehicles: readonly Vehicle[] = []) {
    this.#vehicles = [...vehicles];
  }

  get savedVehicles(): readonly Vehicle[] {
    return this.#vehicles;
  }

  listVehicles(): Promise<VehicleListResponse> {
    return this.isReachable ? Promise.resolve([...this.#vehicles]) : Promise.reject(new PalierUnreachableError('fake'));
  }

  addVehicle({ plate, province, isElectric, hasAccessiblePermit, isOversize }: NewVehicleInput): Promise<Vehicle> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    if (this.nextRejection !== null) {
      return Promise.reject(new PalierRejectedError(this.nextRejection));
    }
    const vehicle = {
      id: `vehicle-${this.#vehicles.length + 1}`,
      plate: plate.trim().toUpperCase(),
      province,
      isDefault: this.#vehicles.length === 0,
      isElectric,
      hasAccessiblePermit,
      isOversize,
    };
    this.#vehicles.push(vehicle);
    return Promise.resolve(vehicle);
  }

  updateVehicleNeeds(vehicleId: string, needs: VehicleNeeds): Promise<Vehicle> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    const index = this.#vehicles.findIndex((vehicle) => vehicle.id === vehicleId);
    const found = this.#vehicles[index];
    if (found === undefined) {
      return Promise.reject(new PalierStatusError(404));
    }
    const updated = { ...found, ...needs };
    this.#vehicles[index] = updated;
    return Promise.resolve(updated);
  }

  setDefaultVehicle(vehicleId: string): Promise<Vehicle> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    this.#vehicles.forEach((vehicle, index) => {
      this.#vehicles[index] = { ...vehicle, isDefault: vehicle.id === vehicleId };
    });
    const chosen = this.#vehicles.find((vehicle) => vehicle.id === vehicleId);
    return chosen === undefined ? Promise.reject(new PalierStatusError(404)) : Promise.resolve(chosen);
  }

  deleteVehicle(vehicleId: string): Promise<void> {
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    if (this.#vehicles.length === 1) {
      return Promise.reject(new PalierRejectedError('LAST_VEHICLE'));
    }
    const index = this.#vehicles.findIndex((vehicle) => vehicle.id === vehicleId);
    if (index === -1) {
      return Promise.reject(new PalierStatusError(404));
    }
    const [removed] = this.#vehicles.splice(index, 1);
    const successor = this.#vehicles[0];
    if (removed?.isDefault && successor !== undefined) {
      this.#vehicles[0] = { ...successor, isDefault: true };
    }
    return Promise.resolve();
  }
}
