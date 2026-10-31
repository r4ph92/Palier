import { and, asc, eq } from 'drizzle-orm';
import type { NewVehicle, Vehicle, VehicleRepository } from '../../domain/vehicles/VehicleRepository.ts';
import type { Database } from './database.ts';
import { vehicle } from './schema.ts';

const vehicleColumns = { id: vehicle.id, plate: vehicle.plate, province: vehicle.province };

export class PostgresVehicleRepository implements VehicleRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  listVehicles(driverId: string): Promise<readonly Vehicle[]> {
    return this.#database.select(vehicleColumns).from(vehicle).where(eq(vehicle.userId, driverId)).orderBy(asc(vehicle.plate));
  }

  async findVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null> {
    const [found] = await this.#database
      .select(vehicleColumns)
      .from(vehicle)
      .where(and(eq(vehicle.id, vehicleId), eq(vehicle.userId, driverId)))
      .limit(1);
    return found ?? null;
  }

  async saveVehicle(driverId: string, newVehicle: NewVehicle): Promise<Vehicle | null> {
    const [saved] = await this.#database
      .insert(vehicle)
      .values({ userId: driverId, plate: newVehicle.plate, plateKey: newVehicle.plateKey, province: newVehicle.province })
      .onConflictDoNothing({ target: [vehicle.userId, vehicle.plateKey, vehicle.province] })
      .returning(vehicleColumns);
    return saved ?? null;
  }
}
