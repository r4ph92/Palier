import { randomUUID } from 'node:crypto';
import type { NewVehicle, Vehicle, VehicleRepository } from '../../src/domain/vehicles/VehicleRepository.ts';

interface StoredVehicle {
  readonly driverId: string;
  readonly plateKey: string;
  readonly vehicle: Vehicle;
}

export class FakeVehicleRepository implements VehicleRepository {
  readonly #stored: StoredVehicle[] = [];

  get savedCount(): number {
    return this.#stored.length;
  }

  listVehicles(driverId: string): Promise<readonly Vehicle[]> {
    return Promise.resolve(this.#stored.filter((stored) => stored.driverId === driverId).map((stored) => stored.vehicle));
  }

  findVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null> {
    const stored = this.#stored.find((entry) => entry.driverId === driverId && entry.vehicle.id === vehicleId);
    return Promise.resolve(stored?.vehicle ?? null);
  }

  saveVehicle(driverId: string, newVehicle: NewVehicle): Promise<Vehicle | null> {
    const duplicate = this.#stored.some(
      (entry) => entry.driverId === driverId && entry.plateKey === newVehicle.plateKey && entry.vehicle.province === newVehicle.province,
    );
    if (duplicate) {
      return Promise.resolve(null);
    }
    const vehicle = { id: randomUUID(), plate: newVehicle.plate, province: newVehicle.province };
    this.#stored.push({ driverId, plateKey: newVehicle.plateKey, vehicle });
    return Promise.resolve(vehicle);
  }
}
