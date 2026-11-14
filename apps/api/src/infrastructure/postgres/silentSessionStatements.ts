import { sql, type SQL } from 'drizzle-orm';
import type { SilenceCheck } from '../../domain/parkingSessions/presumeSilentSessions.ts';
import type { Database, Transaction } from './database.ts';
import { insertSessionEvents, presumedOnJoinedSpot, type SessionEventColumns } from './sessionEventStatements.ts';

type Executor = Pick<Transaction, 'execute'> | Pick<Database, 'execute'>;

export function silentConfirmedEntry(cutoff: Date): SQL {
  return sql`state = 'ENTRY_CONFIRMED' and entry_confirmed_at <= ${cutoff.toISOString()}::timestamptz`;
}

export function unansweredQuestion(cutoff: Date): SQL {
  return sql`state = 'PARKED_UNCONFIRMED' and parked_at <= ${cutoff.toISOString()}::timestamptz`;
}

export async function findLotsWithSilentSessions(database: Executor, cutoff: Date): Promise<string[]> {
  const rows = await database.execute<{ lot_id: string }>(sql`
    select distinct lot_id from parking_session
    where (${silentConfirmedEntry(cutoff)})
       or (${unansweredQuestion(cutoff)})`);
  return rows.map(({ lot_id }) => lot_id);
}

// No spot is written: the loop already made it OCCUPIED, and silence never frees it. The walk would have said when the driver parked; the silence only says by when.
export async function presumeSilentConfirmedEntries(executor: Executor, lotId: string, { cutoff, now }: SilenceCheck): Promise<number> {
  const rows = await executor.execute(withTimeoutEvents(sql`
    update parking_session
    set state = 'PARKED_PRESUMED', presumed_by = 'TIMEOUT', parked_at = ${now.toISOString()}::timestamptz
    where lot_id = ${lotId} and ${silentConfirmedEntry(cutoff)}
    returning id, lot_id, assigned_spot_id`, now));
  return rows.length;
}

// The spot stays OCCUPIED_UNKNOWN and flagged, and parked_at keeps the instant of the question; the event is at the job's clock.
export async function presumeUnansweredQuestions(executor: Executor, lotId: string, { cutoff, now }: SilenceCheck): Promise<number> {
  const rows = await executor.execute(withTimeoutEvents(sql`
    update parking_session
    set state = 'PARKED_PRESUMED', presumed_by = 'TIMEOUT'
    where lot_id = ${lotId} and ${unansweredQuestion(cutoff)}
    returning id, lot_id, assigned_spot_id`, now));
  return rows.length;
}

// One statement logs every session the update presumed, on its assigned spot, at the job's clock reading; one row returned per session.
function withTimeoutEvents(presumption: SQL, now: Date): SQL {
  const timeoutEvent: SessionEventColumns = {
    sessionId: sql`presumed.id`,
    lotId: sql`presumed.lot_id`,
    kind: sql`'PARKING_PRESUMED'`,
    payload: presumedOnJoinedSpot('TIMEOUT'),
    occurredAt: sql`${now.toISOString()}::timestamptz`,
  };
  return sql`
    with presumed as (${presumption})
    ${insertSessionEvents(timeoutEvent, sql`
      from presumed
      join spot on spot.id = presumed.assigned_spot_id
      returning session_id`)}`;
}
