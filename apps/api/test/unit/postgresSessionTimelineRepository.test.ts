import { describe, expect, it } from 'vitest';
import { PostgresSessionTimelineRepository } from '../../src/infrastructure/postgres/PostgresSessionTimelineRepository.ts';
import { sessionDetailSchema, sessionListSchema } from '../../src/http/schemas/sessionTimelineSchemas.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const OPERATOR = 'operator-lavoie';
const LOT = 'lot-demo';
const SESSION = 'session-1';
const LOT_ROW = { lot_name: 'Parking Démo' };
const SESSION_ROW = {
  id: SESSION,
  plate: 'ABC 123',
  state: 'CLOSED_PAID',
  entry_scan_at: '2026-11-15 14:00:00+00',
  exit_at: '2026-11-15 16:00:00+00',
  assigned_spot_number: 'A-1',
  confirmed_spot_number: null,
  presumed_by: 'WALK',
  was_answered: false,
  exit_identification: 'PLATE',
  captured_cents: 1200,
  surplus_paid_cents: 0,
  pending_capture_cents: null,
  pending_surplus_cents: 0,
  unpaid_cents: 0,
};

function repositoryOn(scripted: ScriptedSql) {
  return new PostgresSessionTimelineRepository(scripted.database());
}

describe('the Postgres sessions list', () => {
  it('reads the lot of the operator first, then the sessions of that lot only', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot-name', [LOT_ROW]).answer('list-sessions', [SESSION_ROW]);

    const read = await repositoryOn(scripted).listSessions(OPERATOR, LOT, { status: 'ALL', before: null, limit: 51 });

    expect(scripted.labels()).toEqual(['read-session-lot-name', 'list-sessions']);
    expect(scripted.statement('read-session-lot-name')?.params).toEqual([LOT, OPERATOR]);
    expect(read?.lotName).toBe('Parking Démo');
    expect(read?.sessions[0]).toMatchObject({ id: SESSION, enteredAt: new Date('2026-11-15T14:00:00Z'), exitMethod: 'PLATE' });
  });

  it('answers null without reading a session when the lot is not the operator\'s', async () => {
    const scripted = new ScriptedSql();

    expect(await repositoryOn(scripted).listSessions(OPERATOR, LOT, { status: 'ALL', before: null, limit: 51 })).toBeNull();
    expect(scripted.labels()).toEqual(['read-session-lot-name']);
  });

  it('scopes the list by operator and lot, orders newest first by entry then id, and bounds the page', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot-name', [LOT_ROW]);

    await repositoryOn(scripted).listSessions(OPERATOR, LOT, { status: 'ALL', before: null, limit: 51 });

    const statement = scripted.statement('list-sessions');
    expect(statement?.params).toEqual([OPERATOR, LOT, 51]);
    expect(statement?.text).toMatch(/join parking_lot on parking_lot\.id = ps\.lot_id and parking_lot\.operator_id = \$1/);
    expect(statement?.text).toMatch(/where ps\.lot_id = \$2/);
    expect(statement?.text).toMatch(/order by ps\.entry_scan_at desc, ps\.id desc\s+limit \$3/);
  });

  it('keeps only the active states for OPEN, so the one-active-session predicate applies', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot-name', [LOT_ROW]);

    await repositoryOn(scripted).listSessions(OPERATOR, LOT, { status: 'OPEN', before: null, limit: 51 });

    expect(scripted.statement('list-sessions')?.text).toContain("ps.state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED')");
  });

  it('looks the cursor up inside the lot, so another lot\'s id finds no row', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot-name', [LOT_ROW]);

    await repositoryOn(scripted).listSessions(OPERATOR, LOT, { status: 'ALL', before: 'last-id', limit: 51 });

    const statement = scripted.statement('list-sessions');
    expect(statement?.text).toMatch(/\(ps\.entry_scan_at, ps\.id\) < \(select last_seen\.entry_scan_at, last_seen\.id from parking_session last_seen where last_seen\.id = \$3 and last_seen\.lot_id = \$4\)/);
    expect(statement?.params).toEqual([OPERATOR, LOT, 'last-id', LOT, 51]);
  });

  it('selects explicit columns and never the driver, the card or the payment reference', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot-name', [LOT_ROW]);

    await repositoryOn(scripted).listSessions(OPERATOR, LOT, { status: 'ALL', before: null, limit: 51 });

    const text = scripted.statement('list-sessions')?.text ?? '';
    expect(text).not.toMatch(/select \*|ps\.\*/);
    for (const hidden of ['user_id', 'vehicle_id', 'payment_intent_id', 'card_last4', 'consumed_spot_hold_id', 'app_user']) {
      expect(text).not.toContain(hidden);
    }
  });
});

describe('the Postgres session detail', () => {
  it('reads the session of that operator and lot, then its events by sequence', async () => {
    const scripted = new ScriptedSql()
      .answer('read-session-lot-name', [LOT_ROW])
      .answer('read-session', [SESSION_ROW])
      .answer('read-session-events', [{ sequence: '7', kind: 'CAPTURED', payload: { capturedCents: 1200 }, occurred_at: '2026-11-15 16:00:02+00' }]);

    const read = await repositoryOn(scripted).readSession(OPERATOR, LOT, SESSION);

    expect(scripted.labels()).toEqual(['read-session-lot-name', 'read-session', 'read-session-events']);
    expect(scripted.statement('read-session')?.params).toEqual([OPERATOR, LOT, SESSION]);
    const events = scripted.statement('read-session-events');
    expect(events?.params).toEqual([OPERATOR, SESSION, LOT, 200]);
    expect(events?.text).toMatch(/join parking_lot on parking_lot\.id = event_log\.lot_id and parking_lot\.operator_id = \$1/);
    expect(events?.text).toMatch(/order by event_log\.sequence\s+limit \$4/);
    expect(read?.session?.events).toEqual([{ sequence: 7, kind: 'CAPTURED', occurredAt: new Date('2026-11-15T16:00:02Z'), payload: { capturedCents: 1200 } }]);
  });

  it('reads no event for a session the lot does not hold', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot-name', [LOT_ROW]);

    expect(await repositoryOn(scripted).readSession(OPERATOR, LOT, SESSION)).toEqual({ lotName: 'Parking Démo', session: null });
    expect(scripted.labels()).toEqual(['read-session-lot-name', 'read-session']);
  });

  it('answers null for a lot that is not the operator\'s, before reading any session', async () => {
    const scripted = new ScriptedSql();

    expect(await repositoryOn(scripted).readSession(OPERATOR, LOT, SESSION)).toBeNull();
    expect(scripted.labels()).toEqual(['read-session-lot-name']);
  });

  it('selects explicit columns and never the driver, the card or the payment reference', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot-name', [LOT_ROW]);

    await repositoryOn(scripted).readSession(OPERATOR, LOT, SESSION);

    const text = scripted.statement('read-session')?.text ?? '';
    expect(text).not.toMatch(/select \*|ps\.\*/);
    for (const hidden of ['user_id', 'vehicle_id', 'payment_intent_id', 'card_last4', 'app_user']) {
      expect(text).not.toContain(hidden);
    }
  });
});

describe('the response schemas of the sessions', () => {
  function closedObjects(schema: unknown, path = 'root'): string[] {
    if (typeof schema !== 'object' || schema === null) {
      return [];
    }
    const node = schema as Record<string, unknown>;
    const own = node.type === 'object' && node.additionalProperties !== false ? [path] : [];
    return [...own, ...Object.entries(node).flatMap(([key, value]) => closedObjects(value, `${path}.${key}`))];
  }

  it('close every object, so a field the domain adds by mistake never reaches the answer', () => {
    expect(closedObjects(sessionListSchema)).toEqual([]);
    expect(closedObjects(sessionDetailSchema)).toEqual([]);
  });
});
