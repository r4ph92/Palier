import { sql } from 'drizzle-orm';

// One text for the partial indexes and every hold query, so they agree on what "active" means; no time predicate (#8 expires holds).
export const ACTIVE_SPOT_HOLD = sql.raw(`status = 'ACTIVE'`);
