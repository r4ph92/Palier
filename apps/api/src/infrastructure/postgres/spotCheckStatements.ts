import { sql, type SQL } from 'drizzle-orm';
import type { SpotPlace } from '../../domain/dashboard/LotSpotRepository.ts';
import { activeSessionOf } from './activeSessionStates.ts';
import { ownedLiveSpot } from './lotSpotStatements.ts';

// One row per flagged live spot, oldest flag first, or one row of null spot columns for a lot with none; no row for a lot that is not the operator's.
export function readSpotsToCheckStatement(operatorId: string, lotId: string): SQL {
  return sql`
    select spot.id, spot.number, level.code as level_code, aisle.code as aisle_code, spot.needs_check_since, spot.needs_check_reason, spot.state
    from parking_lot
    left join spot on spot.lot_id = parking_lot.id and spot.needs_check and spot.retired_at is null
    left join aisle on aisle.id = spot.aisle_id
    left join level on level.id = aisle.level_id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
    order by spot.needs_check_since, spot.number`;
}

// Locks the spot row, so no claim sees it free while the flag is judged.
export function lockSpotToClearStatement(operatorId: string, place: SpotPlace): SQL {
  return sql`
    select spot.state, spot.needs_check,
      exists (select 1 from parking_session holder where (holder.assigned_spot_id = spot.id or holder.confirmed_spot_id = spot.id) and ${activeSessionOf('holder')}) as held_by_session
    from spot cross join parking_lot
    where ${ownedLiveSpot(operatorId, place)}
    for update of spot`;
}

export function clearSpotCheckStatement(operatorId: string, place: SpotPlace): SQL {
  return sql`
    update spot set needs_check = false, needs_check_since = null, needs_check_reason = null
    from parking_lot
    where ${ownedLiveSpot(operatorId, place)}
    returning spot.id`;
}
