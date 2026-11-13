import { sql, type SQL } from 'drizzle-orm';
import type { AisleDraft } from '@palier/shared-types/aisleDraft';
import { EXIT_LANE_MINOR } from '@palier/shared-types/beacons';
import { MAX_LEVELS_PER_LOT } from '@palier/shared-types/levelDraft';
import type { LevelPlacement } from '../../domain/dashboard/LotMapRepository.ts';
import type { OwnedLot } from './lockParkingLot.ts';
import { AISLE_MINOR_UNIQUE } from './lotSchema.ts';

// The code stored for the exit lane; the dashboard and the app show their own translated name.
export const EXIT_LANE_CODE = 'Sortie';

// Levels in display order, aisles by code with the exit lane last; a lot with no level reads as one row of nulls.
export function readLotMapStatement({ operatorId, lotId }: OwnedLot): SQL {
  return sql`
    select parking_lot.name as lot_name, parking_lot.beacon_major,
      level.id as level_id, level.code as level_code, level.display_order,
      aisle.id as aisle_id, aisle.code as aisle_code, aisle.beacon_minor, aisle.is_exit_lane, aisle.map_polygon
    from parking_lot
    left join level on level.lot_id = parking_lot.id
    left join aisle on aisle.level_id = level.id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
    order by level.display_order, level.code, aisle.is_exit_lane, aisle.code`;
}

// Appends after the last level; no row when the lot already has MAX_LEVELS_PER_LOT levels.
export function insertLevelStatement({ operatorId, lotId }: OwnedLot, code: string): SQL {
  return sql`
    insert into level (lot_id, code, display_order)
    select parking_lot.id, ${code}, coalesce(max(level.display_order), 0) + 1
    from parking_lot
    left join level on level.lot_id = parking_lot.id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
    group by parking_lot.id
    having count(level.id) < ${MAX_LEVELS_PER_LOT}
    returning id`;
}

// Minor 0 is unique per lot and only the exit lane's (aisle_beacon_minor_matches_lane), so a lot that has one keeps it.
export function insertExitLaneStatement(operatorId: string, levelId: string): SQL {
  return sql`
    insert into aisle (level_id, lot_id, code, beacon_minor, is_exit_lane)
    select level.id, level.lot_id, ${EXIT_LANE_CODE}, ${EXIT_LANE_MINOR}, true
    from level
    join parking_lot on parking_lot.id = level.lot_id
    where level.id = ${levelId} and parking_lot.operator_id = ${operatorId}
    on conflict on constraint ${sql.identifier(AISLE_MINOR_UNIQUE)} do nothing`;
}

// In display order, the order the map shows.
export function readLevelIdsStatement({ operatorId, lotId }: OwnedLot): SQL {
  return sql`
    select level.id from level
    join parking_lot on parking_lot.id = level.lot_id
    where level.lot_id = ${lotId} and parking_lot.operator_id = ${operatorId}
    order by level.display_order, level.code`;
}

// One statement renumbers every level from its place in the list, so no reader sees half an order.
export function reorderLevelsStatement({ operatorId, lotId }: OwnedLot, levelIds: readonly string[]): SQL {
  const ids = sql.join(levelIds.map((id) => sql`${id}`), sql`, `);
  return sql`
    update level set display_order = ordered.position::int
    from unnest(array[${ids}]::uuid[]) with ordinality as ordered(id, position), parking_lot
    where level.id = ordered.id and level.lot_id = ${lotId}
      and parking_lot.id = level.lot_id and parking_lot.operator_id = ${operatorId}`;
}

// No row when the level is not one of this lot's.
export function insertAisleStatement(operatorId: string, { lotId, levelId }: LevelPlacement, aisle: AisleDraft): SQL {
  return sql`
    insert into aisle (level_id, lot_id, code, beacon_minor, map_polygon)
    select level.id, level.lot_id, ${aisle.code}, ${aisle.beaconMinor}, ${JSON.stringify(aisle.rectangle)}::jsonb
    from level
    join parking_lot on parking_lot.id = level.lot_id
    where level.id = ${levelId} and level.lot_id = ${lotId} and parking_lot.operator_id = ${operatorId}
    returning id`;
}
