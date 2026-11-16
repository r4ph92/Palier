import { sql, type SQL } from 'drizzle-orm';
import type { StaleCheck } from '../../domain/parkingSessions/flagStaleSessions.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Database, Transaction } from './database.ts';

type Executor = Pick<Transaction, 'execute'> | Pick<Database, 'execute'>;

// The SQL twin of lastProofOf: greatest ignores a null proof, and is null before the entry is confirmed, so such a session is never stale.
// A walk's parked_at is a proof, a timeout's is not (decision 043). A table alias qualifies every column, for the dashboard's list.
export function lastProofAt(alias = 'parking_session'): SQL {
  const column = (name: string): SQL => sql.raw(`${alias}.${name}`);
  return sql`greatest(${column('entry_confirmed_at')}, case when ${column('presumed_by')} = 'WALK' then ${column('parked_at')} end, ${column('parked_answered_at')}, ${column('presence_confirmed_at')})`;
}

function staleUnflagged(cutoff: Date): SQL {
  return sql`${ACTIVE_SESSION} and stale_flagged_at is null and ${lastProofAt()} <= ${cutoff.toISOString()}::timestamptz`;
}

export async function findLotsWithStaleSessions(database: Executor, cutoff: Date): Promise<string[]> {
  const rows = await database.execute<{ lot_id: string }>(sql`
    select distinct lot_id from parking_session where ${staleUnflagged(cutoff)}`);
  return rows.map(({ lot_id }) => lot_id);
}

// Writes the flag and nothing else: not the state, not the payment, not the spot. The unflagged guard decides any race with a presence check.
export async function flagStaleSessionsOfLot(executor: Executor, lotId: string, { cutoff, now }: StaleCheck): Promise<number> {
  const rows = await executor.execute(sql`
    update parking_session
    set stale_flagged_at = ${now.toISOString()}::timestamptz
    where lot_id = ${lotId} and ${staleUnflagged(cutoff)}
    returning id`);
  return rows.length;
}
