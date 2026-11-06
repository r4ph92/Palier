import { sql } from 'drizzle-orm';
import type { SilenceCheck } from '../../domain/parkingSessions/presumeSilentSessions.ts';
import type { Database, Transaction } from './database.ts';

type Executor = Pick<Transaction, 'execute'> | Pick<Database, 'execute'>;

export async function findLotsWithSilentSessions(database: Executor, cutoff: Date): Promise<string[]> {
  const rows = await database.execute<{ lot_id: string }>(sql`
    select distinct lot_id from parking_session
    where (state = 'ENTRY_CONFIRMED' and entry_confirmed_at <= ${cutoff.toISOString()}::timestamptz)
       or (state = 'PARKED_UNCONFIRMED' and parked_at <= ${cutoff.toISOString()}::timestamptz)`);
  return rows.map(({ lot_id }) => lot_id);
}

// No spot is written: the loop already made it OCCUPIED, and silence never frees it. The walk would have said when the driver parked; the silence only says by when.
export async function presumeSilentConfirmedEntries(tx: Executor, lotId: string, { cutoff, now }: SilenceCheck): Promise<number> {
  const rows = await tx.execute(sql`
    update parking_session
    set state = 'PARKED_PRESUMED', presumed_by = 'TIMEOUT', parked_at = ${now.toISOString()}::timestamptz
    where lot_id = ${lotId} and state = 'ENTRY_CONFIRMED' and entry_confirmed_at <= ${cutoff.toISOString()}::timestamptz
    returning id`);
  return rows.length;
}

// The spot stays OCCUPIED_UNKNOWN and flagged, and parked_at keeps the instant of the question.
export async function presumeUnansweredQuestions(tx: Executor, lotId: string, { cutoff }: SilenceCheck): Promise<number> {
  const rows = await tx.execute(sql`
    update parking_session
    set state = 'PARKED_PRESUMED', presumed_by = 'TIMEOUT'
    where lot_id = ${lotId} and state = 'PARKED_UNCONFIRMED' and parked_at <= ${cutoff.toISOString()}::timestamptz
    returning id`);
  return rows.length;
}
