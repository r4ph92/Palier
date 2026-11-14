import { sql, type SQL } from 'drizzle-orm';
import { EVENT_RETENTION_HOURS, type SessionEvent } from '../../domain/sessionEvents/SessionEvent.ts';
import type { Transaction } from './database.ts';

type Executor = Pick<Transaction, 'execute'>;

export const EVENT_LOG_COLUMNS = sql.raw('session_id, lot_id, kind, payload, occurred_at, purge_after');

// occurredAt: the instant the step itself stored, read in the step's transaction, so the log never disagrees with the session.
export interface SessionEventWrite {
  readonly sessionId: string;
  readonly lotId: string;
  readonly occurredAt: SQL;
  readonly event: SessionEvent;
}

// Always called with the step's own transaction: a step rolled back leaves no event.
export async function appendSessionEvent(tx: Executor, { sessionId, lotId, occurredAt, event }: SessionEventWrite): Promise<void> {
  await tx.execute(sql`
    insert into event_log (${EVENT_LOG_COLUMNS})
    select ${sessionId}::uuid, ${lotId}::uuid, ${event.kind}::text, ${JSON.stringify(event.payload)}::jsonb, step.occurred_at, ${purgeAfter(sql`step.occurred_at`)}
    from (select ${occurredAt} as occurred_at) step`);
}

export function purgeAfter(occurredAt: SQL): SQL {
  return sql`${occurredAt} + make_interval(hours => ${EVENT_RETENTION_HOURS}::int)`;
}

type SessionInstantColumn = 'entry_scan_at' | 'entry_confirmed_at' | 'parked_at' | 'parked_answered_at' | 'cancelled_at';

export function sessionInstant(sessionId: string, column: SessionInstantColumn): SQL {
  return sql`(select ${sql.identifier(column)} from parking_session where id = ${sessionId})`;
}

// For a payload built inside a statement from the rows it writes; every key of the payload type must be given, and no other.
export type PayloadColumns<Payload> = { readonly [Key in keyof Payload]-?: SQL };

export function jsonbObjectOf<Payload>(columns: PayloadColumns<Payload>): SQL {
  const pairs = Object.entries<SQL>(columns).map(([key, value]) => sql`${sql.raw(`'${key}'`)}, ${value}`);
  return sql`jsonb_build_object(${sql.join(pairs, sql`, `)})`;
}
