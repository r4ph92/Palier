import { sql, type SQL } from 'drizzle-orm';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';

// One text for the partial unique indexes and the current-session query, so the query can use the index (docs/decisions/007).
const ACTIVE_STATE_LIST = ACTIVE_ENTRY_SESSION_STATES.map((state) => `'${state}'`).join(', ');

export const ACTIVE_SESSION = sql.raw(`state in (${ACTIVE_STATE_LIST})`);

export function activeSessionOf(alias: string): SQL {
  return sql.raw(`${alias}.state in (${ACTIVE_STATE_LIST})`);
}
