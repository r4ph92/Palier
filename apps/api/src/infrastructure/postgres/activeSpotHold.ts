import { sql } from 'drizzle-orm';

// One text for the partial indexes and every hold query, so they agree on what "active" means; no time predicate: the expiry job ends a hold once it is past its end.
export const ACTIVE_SPOT_HOLD = sql.raw(`status = 'ACTIVE'`);
