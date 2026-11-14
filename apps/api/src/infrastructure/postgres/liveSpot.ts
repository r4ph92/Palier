import { isNull, sql, type SQL } from 'drizzle-orm';
import { spot } from './lotSchema.ts';

// A retired spot stays for its history (decision 035): every reader that counts, offers, names or lists spots skips it.
export function liveSpot(alias = 'spot'): SQL {
  return sql.raw(`${alias}.retired_at is null`);
}

export const isLiveSpot: SQL = isNull(spot.retiredAt);
