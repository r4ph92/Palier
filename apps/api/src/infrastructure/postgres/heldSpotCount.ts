import { sql, type SQL } from 'drizzle-orm';
import { parkingLot } from './lotSchema.ts';

// Counted from the spots themselves, the same rows the free-spot reads exclude by their state.
export const HELD_SPOT_COUNT: SQL<number> = sql<number>`(select count(*)::int from spot where spot.lot_id = ${parkingLot.id} and spot.state = 'HELD')`;
