import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { parkingLot } from './lotSchema.ts';

// Counted from the spots themselves, the same rows the free-spot reads exclude by their state.
export function heldSpotCountOf(lotId: SQLWrapper | string): SQL<number> {
  return sql<number>`(select count(*)::int from spot where spot.lot_id = ${lotId} and spot.state = 'HELD')`;
}

export const HELD_SPOT_COUNT = heldSpotCountOf(parkingLot.id);
