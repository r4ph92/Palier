import { sql } from 'drizzle-orm';
import { bigint, check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SESSION_EVENT_KINDS } from '../../domain/sessionEvents/SessionEvent.ts';
import { parkingSession, sameLotForeignKey } from './entrySchema.ts';

const KIND_LIST = SESSION_EVENT_KINDS.map((kind) => `'${kind}'`).join(', ');

// Append-only log of each step of a visit (decision 037). sequence is the order of writing, which the timeline follows:
// occurred_at keeps each step's own clock, so two events may read out of order when a gate or the test clock runs ahead.
export const eventLog = pgTable(
  'event_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequence: bigint('sequence', { mode: 'number' }).notNull().generatedAlwaysAsIdentity(),
    sessionId: uuid('session_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    // Text with a named check rather than an enum, so the exit kinds (#157) only widen the check.
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    // Computed at write from occurred_at: the retention is data the purge job (#80) reads, not a rule buried in its script.
    purgeAfter: timestamp('purge_after', { withTimezone: true }).notNull(),
  },
  (table) => [
    sameLotForeignKey('event_log_session_in_same_lot_fk', [table.sessionId, table.lotId], parkingSession),
    check('event_log_kind_known', sql`${table.kind} in (${sql.raw(KIND_LIST)})`),
    check('event_log_purge_after_occurrence', sql`${table.purgeAfter} > ${table.occurredAt}`),
    index('event_log_session_id_sequence_index').on(table.sessionId, table.sequence),
    index('event_log_purge_after_index').on(table.purgeAfter),
  ],
);
