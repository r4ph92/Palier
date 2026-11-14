import { sql, type SQL } from 'drizzle-orm';
import type { SpotPlace } from '../../domain/dashboard/LotSpotRepository.ts';
import { liveSpot } from './liveSpot.ts';
import { NATURAL_SPOT_ORDER, ownedLiveSpot } from './lotSpotStatements.ts';
import { sessionHoldsSpot } from './sessionHoldsSpot.ts';

// One row per flagged live spot that is not out of service, oldest flag first, or one row of null spot columns for a lot with none; no row for a lot that is not the operator's.
// An out-of-service spot is not assigned whatever its flag says, so a physical check changes nothing for it.
export function readSpotsToCheckStatement(operatorId: string, lotId: string): SQL {
  return sql`
    select parking_lot.name as lot_name, spot.id, spot.number, level.code as level_code, aisle.code as aisle_code, spot.needs_check_since, spot.needs_check_reason, spot.state,
      ${sessionHoldsSpot('spot')} as held_by_session
    from parking_lot
    left join spot on spot.lot_id = parking_lot.id and spot.needs_check and ${liveSpot()} and spot.state <> 'OUT_OF_SERVICE'
    left join aisle on aisle.id = spot.aisle_id
    left join level on level.id = aisle.level_id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
    order by spot.needs_check_since, ${NATURAL_SPOT_ORDER}`;
}

// Locks the spot row: an entry's claim skips locked rows (for update skip locked), so none takes the spot while its flag is judged.
export function lockSpotToClearStatement(operatorId: string, place: SpotPlace): SQL {
  return sql`
    select spot.state, spot.needs_check,
      ${sessionHoldsSpot('spot')} as held_by_session
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
