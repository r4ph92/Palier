import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { LotAvailabilityRepository } from '../../domain/lots/LotAvailabilityRepository.ts';
import type { OnlineLot } from '../../domain/lots/OnlineLot.ts';
import type { AvailableSpotGroup } from '../../domain/occupancy/availableByCategory.ts';
import type { Database } from './database.ts';
import { ASSIGNED_SPOT_COUNT, HELD_SPOT_COUNT } from './heldSpotCount.ts';
import { onlineLotFromRow } from './onlineLotRow.ts';
import { parkingLot, spot } from './schema.ts';

interface LotSpotGroup extends AvailableSpotGroup {
  readonly lotId: string;
}

// Spots are counted by flag combination; which category a combination belongs to is decided in domain/spots/spotCategories.
export class PostgresLotAvailabilityRepository implements LotAvailabilityRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findOnlineLots(limit: number): Promise<readonly OnlineLot[]> {
    const lots = await this.#database
      .select({
        id: parkingLot.id,
        name: parkingLot.name,
        latitude: parkingLot.latitude,
        longitude: parkingLot.longitude,
        capacity: parkingLot.capacity,
        vehicleCount: parkingLot.vehicleCount,
        heldSpotCount: HELD_SPOT_COUNT,
        assignedSpotCount: ASSIGNED_SPOT_COUNT,
      })
      .from(parkingLot)
      .where(eq(parkingLot.isOnline, true))
      .orderBy(asc(parkingLot.name))
      .limit(limit);
    const groups = await this.#availableSpotGroups(lots.map(({ id }) => id));
    return lots.map((lot) => onlineLotFromRow(lot, groups.filter(({ lotId }) => lotId === lot.id)));
  }

  async #availableSpotGroups(lotIds: readonly string[]): Promise<readonly LotSpotGroup[]> {
    if (lotIds.length === 0) {
      return [];
    }
    return this.#database
      .select({ lotId: spot.lotId, isEv: spot.isEv, isAccessible: spot.isAccessible, isOversize: spot.isOversize, count: count() })
      .from(spot)
      .where(and(inArray(spot.lotId, [...lotIds]), eq(spot.state, 'AVAILABLE')))
      .groupBy(spot.lotId, spot.isEv, spot.isAccessible, spot.isOversize);
  }
}
