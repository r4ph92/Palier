import { sql } from 'drizzle-orm';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';

// One text for the partial unique indexes and the current-session query, so the query can use the index (docs/decisions/007).
export const ACTIVE_SESSION = sql.raw(`state in (${ACTIVE_ENTRY_SESSION_STATES.map((state) => `'${state}'`).join(', ')})`);
