import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

// Counted from the spots themselves, the same rows the free-spot reads exclude by their state.
export function heldSpotCountOf(lotId: SQLWrapper | string): SQL<number> {
  return sql<number>`(select count(*)::int from spot where spot.lot_id = ${lotId} and spot.state = 'HELD')`;
}

// Qualified by hand: Drizzle leaves a single-table select's columns bare, and a bare "id" here would be spot.id.
export const HELD_SPOT_COUNT = heldSpotCountOf(sql.raw('parking_lot.id'));
