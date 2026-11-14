import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { EVENT_RETENTION_HOURS, SESSION_EVENT_KINDS } from '../../src/domain/sessionEvents/SessionEvent.ts';
import { appendSessionEvent, jsonbObjectOf } from '../../src/infrastructure/postgres/sessionEventStatements.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const migration = readFileSync(new URL('../../drizzle/0038_session_event_log.sql', import.meta.url), 'utf8');
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000201';
const GATE_ID = '00000000-0000-4000-8000-000000000701';

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

describe('migration 0038, the visit event log (story #156)', () => {
  it('keeps the session, the lot, the kind, the payload, the instant and the purge date of each event', () => {
    expect(migration).toContain('"session_id" uuid NOT NULL');
    expect(migration).toContain('"lot_id" uuid NOT NULL');
    expect(migration).toContain('"kind" text NOT NULL');
    expect(migration).toContain('"payload" jsonb NOT NULL');
    expect(migration).toContain('"occurred_at" timestamp with time zone NOT NULL');
    expect(migration).toContain('"purge_after" timestamp with time zone NOT NULL');
  });

  it('numbers the events in the order they are written', () => {
    expect(migration).toContain('"sequence" bigint GENERATED ALWAYS AS IDENTITY');
  });

  it('accepts the seven entry and parking kinds only, by a named check', () => {
    const kinds = SESSION_EVENT_KINDS.map((kind) => `'${kind}'`).join(', ');

    expect(migration).toContain(`CONSTRAINT "event_log_kind_known" CHECK ("event_log"."kind" in (${kinds}))`);
    expect(SESSION_EVENT_KINDS).toHaveLength(7);
  });

  it('refuses a purge date that is not after the event, and leaves the retention to the data', () => {
    expect(migration).toContain(`CONSTRAINT "event_log_purge_after_occurrence" CHECK ("event_log"."purge_after" > "event_log"."occurred_at")`);
    expect(migration).not.toMatch(/2160|90 days/);
  });

  it("ties each event to a session of its own lot, which a plain session key would not check", () => {
    expect(migration).toContain(
      `ADD CONSTRAINT "event_log_session_in_same_lot_fk" FOREIGN KEY ("session_id","lot_id") REFERENCES "public"."parking_session"("id","lot_id") ON DELETE no action`,
    );
  });

  it('indexes the timeline by session in write order, and the purge by date', () => {
    expect(migration).toContain('CREATE INDEX "event_log_session_id_sequence_index" ON "event_log" USING btree ("session_id","sequence")');
    expect(migration).toContain('CREATE INDEX "event_log_purge_after_index" ON "event_log" USING btree ("purge_after")');
  });
});

describe('appending a session event', () => {
  async function appendLoop(scripted: ScriptedSql): Promise<void> {
    await scripted.database().transaction((tx) =>
      appendSessionEvent(tx, {
        sessionId: SESSION_ID,
        lotId: LOT_ID,
        occurredAt: 'entry_confirmed_at',
        event: { kind: 'ENTRY_LOOP_CLOSED', payload: { gateId: GATE_ID } },
      }),
    );
  }

  it('computes the purge date at write, 2160 hours after the very instant it stores', async () => {
    const scripted = new ScriptedSql();

    await appendLoop(scripted);

    const append = scripted.statement('append-session-event');
    expect(oneLine(append?.text)).toMatch(/, step\.occurred_at, step\.occurred_at \+ make_interval\(hours => \$\d+::int\) from \(select \(select "entry_confirmed_at" from parking_session where id = \$\d+\) as occurred_at\) step$/);
    expect(append?.params[4]).toBe(EVENT_RETENTION_HOURS);
    expect(EVENT_RETENTION_HOURS).toBe(90 * 24);
  });

  it("reads the step's instant from the session the event is written for", async () => {
    const scripted = new ScriptedSql();

    await appendLoop(scripted);

    const append = scripted.statement('append-session-event');
    expect(append?.params.at(-1)).toBe(SESSION_ID);
    expect(append?.params.filter((param) => param === SESSION_ID)).toHaveLength(2);
  });

  it('binds the session, the lot, the kind and the payload as values, the payload as JSON', async () => {
    const scripted = new ScriptedSql();

    await appendLoop(scripted);

    const append = scripted.statement('append-session-event');
    expect(oneLine(append?.text)).toMatch(/^insert into event_log \(session_id, lot_id, kind, payload, occurred_at, purge_after\) select \$1::uuid, \$2::uuid, \$3::text, \$4::jsonb,/);
    expect(append?.params.slice(0, 4)).toEqual([SESSION_ID, LOT_ID, 'ENTRY_LOOP_CLOSED', JSON.stringify({ gateId: GATE_ID })]);
  });

  it('builds a payload inside a statement from the given columns, under their payload keys', () => {
    const scripted = new ScriptedSql();

    void scripted.executor().execute(sql`select ${jsonbObjectOf<{ spotId: string; spotNumber: string }>({ spotId: sql`spot.id`, spotNumber: sql`spot.number` })}`);

    expect(scripted.statements[0]?.text).toBe(`select jsonb_build_object('spotId', spot.id, 'spotNumber', spot.number)`);
  });
});
