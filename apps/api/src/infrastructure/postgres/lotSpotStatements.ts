import { sql, type SQL } from 'drizzle-orm';
import type { SpotAttributes } from '@palier/shared-types/spotDraft';
import type { AislePlace, SpotBatch, SpotPlace } from '../../domain/dashboard/LotSpotRepository.ts';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import { canonicalNumberOf } from './canonicalNumberSql.ts';
import { liveSpotCountOf } from './heldSpotCount.ts';
import { liveSpot } from './liveSpot.ts';
import { sessionHoldsSpot } from './sessionHoldsSpot.ts';

// Prefix first, then the number at its end read as a number: A-2 before A-10, and B-7a after the A spots.
export const NATURAL_SPOT_ORDER = sql.raw(`regexp_replace(spot.number, '[0-9]+$', ''), substring(spot.number from '[0-9]+$')::numeric nulls first, spot.number`);

// Free or out of service, and no active session or hold points at it: nothing to wait for before it goes.
const SPOT_NOT_IN_USE = sql`spot.state in ('AVAILABLE', 'OUT_OF_SERVICE')
  and not ${sessionHoldsSpot('spot')}
  and not exists (select 1 from spot_hold where spot_hold.spot_id = spot.id and ${ACTIVE_SPOT_HOLD})`;

// No session, hold or report ever pointed at it, so the row can go without breaking a foreign key.
const SPOT_WITHOUT_HISTORY = sql`not exists (select 1 from parking_session past where past.assigned_spot_id = spot.id and past.lot_id = spot.lot_id)
  and not exists (select 1 from parking_session past where past.confirmed_spot_id = spot.id and past.lot_id = spot.lot_id)
  and not exists (select 1 from spot_hold past where past.spot_id = spot.id and past.lot_id = spot.lot_id)
  and not exists (select 1 from parking_session_reported_spot past where past.spot_id = spot.id and past.lot_id = spot.lot_id)`;

function ownedParkingAisle(operatorId: string, { lotId, aisleId }: AislePlace): SQL {
  return sql`aisle.id = ${aisleId} and aisle.lot_id = ${lotId} and not aisle.is_exit_lane and parking_lot.id = aisle.lot_id and parking_lot.operator_id = ${operatorId}`;
}

// A spot not retired, of a lot of this operator.
export function ownedLiveSpot(operatorId: string, { lotId, spotId }: SpotPlace): SQL {
  return sql`spot.id = ${spotId} and spot.lot_id = ${lotId} and ${liveSpot()} and parking_lot.id = spot.lot_id and parking_lot.operator_id = ${operatorId}`;
}

function textArrayOf(values: readonly string[]): SQL {
  return sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}

// One row per live spot in natural order, or one row of null spot columns for an empty aisle; no row for any other aisle.
export function readAisleSpotsStatement(operatorId: string, aisle: AislePlace): SQL {
  return sql`
    select aisle.id as aisle_id, parking_lot.capacity, lot_spots.spot_count,
      spot.id, spot.number, spot.state, spot.is_ev, spot.is_accessible, spot.is_oversize, spot.distance_to_exit
    from aisle
    cross join parking_lot
    cross join ${liveSpotCountOf(aisle.lotId)} as lot_spots(spot_count)
    left join spot on spot.aisle_id = aisle.id and ${liveSpot()}
    where ${ownedParkingAisle(operatorId, aisle)}
    order by ${NATURAL_SPOT_ORDER}`;
}

export function readParkingAisleStatement(operatorId: string, aisle: AislePlace): SQL {
  return sql`select aisle.id from aisle cross join parking_lot where ${ownedParkingAisle(operatorId, aisle)}`;
}

export function countLiveSpotsStatement(operatorId: string, lotId: string): SQL {
  return sql`select ${liveSpotCountOf(lotId)} as spot_count from parking_lot where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}`;
}

// The live spot of the lot that reads the same as the earliest new number (A-3 and « a 3 » are one number), if any.
export function firstTakenNumberStatement(operatorId: string, lotId: string, numbers: readonly string[]): SQL {
  return sql`
    select spot.number
    from unnest(${textArrayOf(numbers)}) with ordinality as wanted(number, position)
    join spot on spot.lot_id = ${lotId} and ${liveSpot()} and ${canonicalNumberOf(sql.raw('spot.number'))} = ${canonicalNumberOf(sql.raw('wanted.number'))}
    join parking_lot on parking_lot.id = spot.lot_id and parking_lot.operator_id = ${operatorId}
    order by wanted.position, spot.number
    limit 1`;
}

export function insertSpotsStatement(operatorId: string, aisle: AislePlace, { numbers, attributes }: SpotBatch): SQL {
  return sql`
    insert into spot (aisle_id, lot_id, number, is_ev, is_accessible, is_oversize, distance_to_exit)
    select aisle.id, aisle.lot_id, wanted.number, ${attributesOf(attributes)}
    from aisle cross join parking_lot cross join unnest(${textArrayOf(numbers)}) as wanted(number)
    where ${ownedParkingAisle(operatorId, aisle)}
    returning spot.id`;
}

function attributesOf({ isEv, isAccessible, isOversize, distanceToExit }: SpotAttributes): SQL {
  return sql`${isEv}::boolean, ${isAccessible}::boolean, ${isOversize}::boolean, ${distanceToExit}::int`;
}

// The number never changes: allocation reads the flags and the distance when it claims a spot, so a spot in use keeps its claim.
export function changeSpotStatement(operatorId: string, place: SpotPlace, { isEv, isAccessible, isOversize, distanceToExit }: SpotAttributes): SQL {
  return sql`
    update spot set is_ev = ${isEv}::boolean, is_accessible = ${isAccessible}::boolean, is_oversize = ${isOversize}::boolean, distance_to_exit = ${distanceToExit}::int
    from parking_lot
    where ${ownedLiveSpot(operatorId, place)}
    returning spot.aisle_id`;
}

export function deleteSpotWithoutHistoryStatement(operatorId: string, place: SpotPlace): SQL {
  return sql`
    delete from spot using parking_lot
    where ${ownedLiveSpot(operatorId, place)} and spot.state in ('AVAILABLE', 'OUT_OF_SERVICE') and ${SPOT_WITHOUT_HISTORY}
    returning spot.aisle_id`;
}

// Out of service as well, so no reader that skips only by state ever hands it out (spot_retired_out_of_service).
export function retireSpotStatement(operatorId: string, place: SpotPlace): SQL {
  return sql`
    update spot set retired_at = now(), state = 'OUT_OF_SERVICE', state_changed_at = now()
    from parking_lot
    where ${ownedLiveSpot(operatorId, place)} and ${SPOT_NOT_IN_USE}
    returning spot.aisle_id`;
}

export function readLiveSpotStatement(operatorId: string, place: SpotPlace): SQL {
  return sql`select spot.id from spot cross join parking_lot where ${ownedLiveSpot(operatorId, place)}`;
}
