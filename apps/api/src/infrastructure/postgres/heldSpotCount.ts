import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { liveSpot } from './liveSpot.ts';

// Counted from the spots themselves, the same rows the free-spot reads exclude by their state.
export function heldSpotCountOf(lotId: SQLWrapper | string): SQL<number> {
  return sql<number>`(select count(*)::int from spot where spot.lot_id = ${lotId} and spot.state = 'HELD')`;
}

// An ASSIGNED spot is an admitted entry whose loop has not closed: the closure moves it to OCCUPIED as it counts the vehicle.
export function assignedSpotCountOf(lotId: SQLWrapper | string): SQL<number> {
  return sql<number>`(select count(*)::int from spot where spot.lot_id = ${lotId} and spot.state = 'ASSIGNED')`;
}

// Bound to the lot id, not to a row: Postgres counts once per statement, however many spot rows the statement returns.
export function liveSpotCountOf(lotId: string): SQL<number> {
  return sql<number>`(select count(*)::int from spot where spot.lot_id = ${lotId} and ${liveSpot()})`;
}

// Qualified by hand: Drizzle leaves a single-table select's columns bare, and a bare "id" here would be spot.id.
export const HELD_SPOT_COUNT = heldSpotCountOf(sql.raw('parking_lot.id'));
export const ASSIGNED_SPOT_COUNT = assignedSpotCountOf(sql.raw('parking_lot.id'));
