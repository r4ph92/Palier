import { asc, eq, sql, type SQL } from 'drizzle-orm';
import type { LotAvailabilityRepository } from '../../domain/lots/LotAvailabilityRepository.ts';
import type { OnlineLot } from '../../domain/lots/OnlineLot.ts';
import type { Database } from './database.ts';
import { onlineLotFromRow } from './onlineLotRow.ts';
import { parkingLot, spot } from './schema.ts';

export const ONLINE_LOTS_LIMIT = 50;

export class PostgresLotAvailabilityRepository implements LotAvailabilityRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findOnlineLots(): Promise<readonly OnlineLot[]> {
    const rows = await this.#database
      .select(onlineLotColumns())
      .from(parkingLot)
      .leftJoin(spot, eq(spot.lotId, parkingLot.id))
      .where(eq(parkingLot.isOnline, true))
      .groupBy(parkingLot.id)
      .orderBy(asc(parkingLot.name))
      .limit(ONLINE_LOTS_LIMIT);
    return rows.map(onlineLotFromRow);
  }
}

function onlineLotColumns() {
  return {
    id: parkingLot.id,
    name: parkingLot.name,
    latitude: parkingLot.latitude,
    longitude: parkingLot.longitude,
    capacity: parkingLot.capacity,
    vehicleCount: parkingLot.vehicleCount,
    availableSpotCount: availableSpotsWhere(sql`true`),
    availableStandard: availableSpotsWhere(sql`not (${spot.isEv} or ${spot.isAccessible} or ${spot.isOversize})`),
    availableElectric: availableSpotsWhere(sql`${spot.isEv}`),
    availableAccessible: availableSpotsWhere(sql`${spot.isAccessible}`),
    availableOversize: availableSpotsWhere(sql`${spot.isOversize}`),
  };
}

function availableSpotsWhere(condition: SQL): SQL<number> {
  return sql<number>`count(${spot.id}) filter (where ${spot.state} = 'AVAILABLE' and ${condition})`.mapWith(Number);
}
