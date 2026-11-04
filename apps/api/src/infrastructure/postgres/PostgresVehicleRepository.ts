import { and, asc, eq, ne } from 'drizzle-orm';
import type { DeleteVehicleResult, NewVehicle, Vehicle, VehicleRepository } from '../../domain/vehicles/VehicleRepository.ts';
import type { Database, Transaction } from './database.ts';
import { appUser, vehicle } from './schema.ts';

const vehicleColumns = { id: vehicle.id, plate: vehicle.plate, province: vehicle.province, isDefault: vehicle.isDefault };

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

  async findDefaultVehicle(driverId: string): Promise<Vehicle | null> {
    const [found] = await this.#database
      .select(vehicleColumns)
      .from(vehicle)
      .where(and(eq(vehicle.userId, driverId), eq(vehicle.isDefault, true)))
      .limit(1);
    return found ?? null;
  }

  // The first vehicle of a driver is the default one.
  saveVehicle(driverId: string, newVehicle: NewVehicle): Promise<Vehicle | null> {
    return this.#database.transaction(async (tx) => {
      await lockDriver(tx, driverId);
      const [existing] = await tx.select({ id: vehicle.id }).from(vehicle).where(eq(vehicle.userId, driverId)).limit(1);
      const [saved] = await tx
        .insert(vehicle)
        .values({
          userId: driverId,
          plate: newVehicle.plate,
          plateKey: newVehicle.plateKey,
          province: newVehicle.province,
          isDefault: existing === undefined,
        })
        .onConflictDoNothing({ target: [vehicle.userId, vehicle.plateKey, vehicle.province] })
        .returning(vehicleColumns);
      return saved ?? null;
    });
  }

  // The old default is cleared first, so the one-default-per-driver index is never broken between the two writes.
  setDefaultVehicle(driverId: string, vehicleId: string): Promise<Vehicle | null> {
    return this.#database.transaction(async (tx) => {
      await lockDriver(tx, driverId);
      const found = await findOwnedVehicle(tx, driverId, vehicleId);
      if (found === null) {
        return null;
      }
      await tx.update(vehicle).set({ isDefault: false }).where(and(eq(vehicle.userId, driverId), eq(vehicle.isDefault, true)));
      const [updated] = await tx.update(vehicle).set({ isDefault: true }).where(eq(vehicle.id, vehicleId)).returning(vehicleColumns);
      return updated ?? null;
    });
  }

  deleteVehicle(driverId: string, vehicleId: string): Promise<DeleteVehicleResult> {
    return this.#database.transaction(async (tx) => {
      await lockDriver(tx, driverId);
      const found = await findOwnedVehicle(tx, driverId, vehicleId);
      if (found === null) {
        return 'not-found';
      }
      const successor = await firstOtherVehicle(tx, driverId, vehicleId);
      if (successor === undefined) {
        return 'last-vehicle';
      }
      await tx.delete(vehicle).where(eq(vehicle.id, vehicleId));
      if (found.isDefault) {
        await tx.update(vehicle).set({ isDefault: true }).where(eq(vehicle.id, successor.id));
      }
      return 'deleted';
    });
  }
}

async function findOwnedVehicle(tx: Transaction, driverId: string, vehicleId: string): Promise<Vehicle | null> {
  const [found] = await tx
    .select(vehicleColumns)
    .from(vehicle)
    .where(and(eq(vehicle.id, vehicleId), eq(vehicle.userId, driverId)))
    .limit(1);
  return found ?? null;
}

// The vehicle that takes over the default when the default one is deleted.
async function firstOtherVehicle(tx: Transaction, driverId: string, vehicleId: string): Promise<{ readonly id: string } | undefined> {
  const [other] = await tx
    .select({ id: vehicle.id })
    .from(vehicle)
    .where(and(eq(vehicle.userId, driverId), ne(vehicle.id, vehicleId)))
    .orderBy(asc(vehicle.plate))
    .limit(1);
  return other;
}

// Concurrent changes to one driver's vehicles run one after the other, so each sees the others' writes (the last vehicle, the one default).
async function lockDriver(tx: Transaction, driverId: string): Promise<void> {
  await tx.select({ id: appUser.id }).from(appUser).where(eq(appUser.id, driverId)).for('update');
}
