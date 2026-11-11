import { randomUUID } from 'node:crypto';
import type { DeleteVehicleResult, NewVehicle, Vehicle, VehicleEdit, VehicleNeeds, VehicleRepository } from '../../src/domain/vehicles/VehicleRepository.ts';

export const standardNeeds: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };

interface StoredVehicle extends VehicleNeeds {
  readonly driverId: string;
  readonly plateKey: string;
  readonly id: string;
  readonly plate: string;
  readonly province: string;
  isDefault: boolean;
  transponder: string | null;
}

export class FakeVehicleRepository implements VehicleRepository {
  readonly #stored: StoredVehicle[] = [];

  get savedCount(): number {
    return this.#stored.length;
  }

  listVehicles(driverId: string): Promise<readonly Vehicle[]> {
    return Promise.resolve(this.#ownedBy(driverId).map(toVehicle));
  }

  findVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null> {
    const found = this.#find(driverId, vehicleId);
    return Promise.resolve(found === undefined ? null : toVehicle(found));
  }

  findDefaultVehicle(driverId: string): Promise<Vehicle | null> {
    const found = this.#ownedBy(driverId).find((stored) => stored.isDefault);
    return Promise.resolve(found === undefined ? null : toVehicle(found));
  }

  saveVehicle(driverId: string, newVehicle: NewVehicle): Promise<Vehicle | null> {
    const duplicate = this.#stored.some(
      (entry) => entry.driverId === driverId && entry.plateKey === newVehicle.plateKey && entry.province === newVehicle.province,
    );
    if (duplicate) {
      return Promise.resolve(null);
    }
    const stored: StoredVehicle = {
      driverId,
      plateKey: newVehicle.plateKey,
      id: randomUUID(),
      plate: newVehicle.plate,
      province: newVehicle.province,
      isDefault: this.#ownedBy(driverId).length === 0,
      transponder: null,
      isElectric: newVehicle.isElectric,
      hasAccessiblePermit: newVehicle.hasAccessiblePermit,
      isOversize: newVehicle.isOversize,
    };
    this.#stored.push(stored);
    return Promise.resolve(toVehicle(stored));
  }

  updateVehicleNeeds(driverId: string, vehicleId: string, { transponder, ...needs }: VehicleEdit): Promise<Vehicle | null> {
    const target = this.#find(driverId, vehicleId);
    if (target === undefined) {
      return Promise.resolve(null);
    }
    const updated: StoredVehicle = { ...target, ...needs, transponder: transponder === undefined ? target.transponder : (transponder?.transponder ?? null) };
    this.#stored.splice(this.#stored.indexOf(target), 1, updated);
    return Promise.resolve(toVehicle(updated));
  }

  setDefaultVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null> {
    const target = this.#find(driverId, vehicleId);
    if (target === undefined) {
      return Promise.resolve(null);
    }
    for (const stored of this.#ownedBy(driverId)) {
      stored.isDefault = stored.id === vehicleId;
    }
    return Promise.resolve(toVehicle(target));
  }

  deleteVehicle(driverId: string, vehicleId: string): Promise<DeleteVehicleResult> {
    const target = this.#find(driverId, vehicleId);
    if (target === undefined) {
      return Promise.resolve('not-found');
    }
    const remaining = this.#ownedBy(driverId).filter((stored) => stored.id !== vehicleId);
    if (remaining.length === 0) {
      return Promise.resolve('last-vehicle');
    }
    this.#stored.splice(this.#stored.indexOf(target), 1);
    const [successor] = remaining;
    if (target.isDefault && successor !== undefined) {
      successor.isDefault = true;
    }
    return Promise.resolve('deleted');
  }

  #ownedBy(driverId: string): StoredVehicle[] {
    return this.#stored.filter((stored) => stored.driverId === driverId);
  }

  #find(driverId: string, vehicleId: string): StoredVehicle | undefined {
    return this.#ownedBy(driverId).find((stored) => stored.id === vehicleId);
  }
}

function toVehicle({ id, plate, province, isDefault, transponder, isElectric, hasAccessiblePermit, isOversize }: StoredVehicle): Vehicle {
  return { id, plate, province, isDefault, transponder, isElectric, hasAccessiblePermit, isOversize };
}
