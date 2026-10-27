import { asc, eq, sql } from 'drizzle-orm';
import type { LotAvailabilityRepository } from '../../domain/lots/LotAvailabilityRepository.ts';
import type { LotAvailability } from '../../domain/occupancy/LotAvailability.ts';
import type { Database } from './database.ts';
import { parkingLot, spot } from './schema.ts';

export class PostgresLotAvailabilityRepository implements LotAvailabilityRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  findOnlineLots(): Promise<readonly LotAvailability[]> {
    return this.#database
      .select({
        id: parkingLot.id,
        name: parkingLot.name,
        capacity: parkingLot.capacity,
        vehicleCount: parkingLot.vehicleCount,
        availableSpotCount: sql<number>`count(${spot.id}) filter (where ${spot.state} = 'AVAILABLE')`.mapWith(Number),
      })
      .from(parkingLot)
      .leftJoin(spot, eq(spot.lotId, parkingLot.id))
      .where(eq(parkingLot.isOnline, true))
      .groupBy(parkingLot.id)
      .orderBy(asc(parkingLot.name));
  }
}
