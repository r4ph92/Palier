import { sql, type SQL } from 'drizzle-orm';
import { EVENT_RETENTION_HOURS, type ParkingPresumedPayload, type SessionEvent } from '../../domain/sessionEvents/SessionEvent.ts';
import type { Transaction } from './database.ts';

type SessionInstantColumn = 'entry_scan_at' | 'entry_confirmed_at' | 'parked_at' | 'parked_answered_at' | 'cancelled_at';

// A column of the event's own session, or an instant another row stored (the gate command's issued_at).
export type EventInstant = SessionInstantColumn | SQL;

// occurredAt: the instant the step itself stored, read in the step's transaction.
export interface SessionEventWrite {
  readonly sessionId: string;
  readonly lotId: string;
  readonly occurredAt: EventInstant;
  readonly event: SessionEvent;
}

// Always called with the step's own transaction: a step rolled back leaves no event.
export async function appendSessionEvent(tx: Transaction, write: SessionEventWrite): Promise<void> {
  const { sessionId, lotId, event } = write;
  const row: SessionEventColumns = {
    sessionId: sql`${sessionId}::uuid`,
    lotId: sql`${lotId}::uuid`,
    kind: sql`${event.kind}::text`,
    payload: sql`${JSON.stringify(event.payload)}::jsonb`,
    occurredAt: sql`step.occurred_at`,
  };
  await tx.execute(insertSessionEvents(row, sql`from (select ${instantOf(write)} as occurred_at) step`));
}

// A session column is always read for the session the event is written for, never another one.
function instantOf({ sessionId, occurredAt }: SessionEventWrite): SQL {
  if (typeof occurredAt !== 'string') {
    return occurredAt;
  }
  return sql`(select ${sql.identifier(occurredAt)} from parking_session where id = ${sessionId})`;
}

// Each value of an event row, as an expression over the statement's source; purge_after is never given, it follows occurredAt.
export interface SessionEventColumns {
  readonly sessionId: SQL;
  readonly lotId: SQL;
  readonly kind: SQL;
  readonly payload: SQL;
  readonly occurredAt: SQL;
}

// The one insert into the log, one row per source row. source: the from clause and anything after it (order by, returning).
export function insertSessionEvents({ sessionId, lotId, kind, payload, occurredAt }: SessionEventColumns, source: SQL): SQL {
  return sql`
    insert into event_log (session_id, lot_id, kind, payload, occurred_at, purge_after)
    select ${sessionId}, ${lotId}, ${kind}, ${payload}, ${occurredAt}, ${purgeAfter(occurredAt)}
    ${source}`;
}

function purgeAfter(occurredAt: SQL): SQL {
  return sql`${occurredAt} + make_interval(hours => ${EVENT_RETENTION_HOURS}::int)`;
}

// A presumption on the spot the statement joined as `spot`.
export function presumedOnJoinedSpot(evidence: ParkingPresumedPayload['evidence']): SQL {
  return jsonbObjectOf<ParkingPresumedPayload>({ evidence: sql.raw(`'${evidence}'`), spotId: sql`spot.id`, spotNumber: sql`spot.number` });
}

// For a payload built inside a statement from the rows it writes; every key of the payload type must be given, and no other.
export type PayloadColumns<Payload> = { readonly [Key in keyof Payload]-?: SQL };

export function jsonbObjectOf<Payload>(columns: PayloadColumns<Payload>): SQL {
  const pairs = Object.entries<SQL>(columns).map(([key, value]) => sql`${sql.raw(`'${key}'`)}, ${value}`);
  return sql`jsonb_build_object(${sql.join(pairs, sql`, `)})`;
}
