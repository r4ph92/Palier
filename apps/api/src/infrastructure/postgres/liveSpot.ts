import { isNull, sql, type SQL } from 'drizzle-orm';
import { spot } from './lotSchema.ts';

// A retired spot stays for its history (decision 035): every reader that counts, offers, names or lists spots skips it.
export function liveSpot(alias: 'spot' | 's' = 'spot'): SQL {
  return sql.raw(`${alias}.retired_at is null`);
}

export const isLiveSpot: SQL = isNull(spot.retiredAt);

// Bound to the lot id, not to a row: Postgres counts once per statement, however many spot rows the statement returns.
export function liveSpotCountOf(lotId: string): SQL<number> {
  return sql<number>`(select count(*)::int from spot where spot.lot_id = ${lotId} and ${liveSpot()})`;
}
