import { sql } from 'drizzle-orm';

// One text for the partial indexes and every hold query, so each query can use its index; no time predicate (#8 expires holds).
export const ACTIVE_SPOT_HOLD = sql.raw(`status = 'ACTIVE'`);
