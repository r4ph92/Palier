import { sql } from 'drizzle-orm';
import { SPOT_STATES, type SpotState } from '@palier/shared-types/spotStates';
import type { LevelOccupancy, LevelOccupancyReader } from '../../domain/dashboard/LevelOccupancyReader.ts';
import { confirmedAssignedSpotOf } from './confirmedAssignedSpot.ts';
import type { Database } from './database.ts';

type OccupancyRow = {
  readonly lot_name: string;
  readonly vehicle_count: number;
  readonly level_code: string | null;
  readonly state: SpotState | null;
  readonly spot_count: number;
  readonly confirmed_assigned_count: number;
};

type Counts = Record<SpotState, number>;

export class PostgresLevelOccupancyReader implements LevelOccupancyReader {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  // One statement is one snapshot: levels, spots and the counter agree with each other without locking the lot.
  async readLevelOccupancy(operatorId: string, lotId: string): Promise<LevelOccupancy | null> {
    const rows = await this.#database.execute<OccupancyRow>(sql`
      select parking_lot.name as lot_name, parking_lot.vehicle_count, level.code as level_code, spot.state,
        count(spot.id)::int as spot_count,
        (count(spot.id) filter (where ${confirmedAssignedSpotOf(sql.raw('spot.id'))}))::int as confirmed_assigned_count
      from parking_lot
      left join level on level.lot_id = parking_lot.id
      left join aisle on aisle.level_id = level.id
      left join spot on spot.aisle_id = aisle.id
      where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
      group by parking_lot.id, level.id, spot.state
      order by level.display_order, level.code`);
    return occupancyOf(rows);
  }
}

function occupancyOf(rows: readonly OccupancyRow[]): LevelOccupancy | null {
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  const countsByLevel = new Map<string, Counts>();
  for (const { level_code: code, state, spot_count: count } of rows) {
    if (code !== null) {
      const counts = countsByLevel.get(code) ?? emptyCounts();
      countsByLevel.set(code, state === null ? counts : { ...counts, [state]: count });
    }
  }
  return {
    lotName: first.lot_name,
    vehicleCount: first.vehicle_count,
    levels: [...countsByLevel].map(([code, counts]) => ({ code, counts })),
    confirmedAssignedCount: rows.reduce((total, row) => total + row.confirmed_assigned_count, 0),
  };
}

function emptyCounts(): Counts {
  return Object.fromEntries(SPOT_STATES.map((state) => [state, 0])) as Counts;
}
