import { describe, expect, it } from 'vitest';
import { PostgresStaleSessionReviewRepository } from '../../src/infrastructure/postgres/PostgresStaleSessionReviewRepository.ts';
import { appendedSessionEvents, onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const SOPHIE_OPERATOR = 'operator-lavoie';
const PARKING_DEMO = 'lot-demo';
const SESSION_ID = 'session-julie';
const SOPHIE_ID = 'user-sophie';
const CONFIRMED_AT = new Date('2026-11-12T10:00:00Z');
const check = { lotId: PARKING_DEMO, sessionId: SESSION_ID, memberId: SOPHIE_ID, confirmedAt: CONFIRMED_AT };
const julieRow = {
  lot_name: 'Parking Démo',
  id: SESSION_ID,
  plate: 'ABC 123',
  number: 'A-1',
  aisle_code: 'A',
  level_code: 'P1',
  entry_confirmed_at: new Date('2026-11-01T09:00:00Z'),
  parked_at: '2026-11-01T09:30:00.000Z',
  presumed_by: 'WALK',
  parked_answered_at: null,
  presence_confirmed_at: null,
  stale_flagged_at: new Date('2026-11-08T09:00:00Z'),
};
const noSession = { lot_name: 'Parking Démo', ...Object.fromEntries(Object.keys(julieRow).slice(1).map((column) => [column, null])) };

function repositoryOn(scripted: ScriptedSql) {
  return new PostgresStaleSessionReviewRepository(scripted.database());
}

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-owned-lot', [{ id: PARKING_DEMO }]);
}

describe('reading the stale sessions from Postgres', () => {
  it('lists the open flagged sessions of the operator lot, oldest flag first, in one statement with explicit columns', async () => {
    const scripted = new ScriptedSql().answer('list-stale-sessions', [julieRow]);

    const list = await repositoryOn(scripted).listStaleSessions(SOPHIE_OPERATOR, PARKING_DEMO);

    expect(list?.sessions).toEqual([
      {
        id: SESSION_ID,
        plate: 'ABC 123',
        spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
        proofs: {
          entryConfirmedAt: new Date('2026-11-01T09:00:00Z'),
          parkedAt: new Date('2026-11-01T09:30:00Z'),
          presumedBy: 'WALK',
          parkedAnsweredAt: null,
          presenceConfirmedAt: null,
        },
        flaggedAt: new Date('2026-11-08T09:00:00Z'),
      },
    ]);
    const { text, params } = scripted.statement('list-stale-sessions') ?? { text: '', params: [] };
    expect(text).toMatch(/ps\.stale_flagged_at is not null and ps\.state in \('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED'\)/);
    expect(text).toMatch(/left join spot on spot\.id = coalesce\(ps\.confirmed_spot_id, ps\.assigned_spot_id\)/);
    expect(text).toMatch(/where parking_lot\.id = \$1 and parking_lot\.operator_id = \$2\s+order by ps\.stale_flagged_at, ps\.id\s+limit \$3/);
    expect(text).not.toMatch(/user_id|vehicle_id|payment_intent_id|card_last4/);
    expect(params).toEqual([PARKING_DEMO, SOPHIE_OPERATOR, 200]);
  });

  it('reads an owned lot with nothing flagged as its name and no session, and another operator lot as null', async () => {
    const empty = new ScriptedSql().answer('list-stale-sessions', [noSession]);

    expect(await repositoryOn(empty).listStaleSessions(SOPHIE_OPERATOR, PARKING_DEMO)).toEqual({ lotName: 'Parking Démo', sessions: [] });
    expect(await repositoryOn(new ScriptedSql()).listStaleSessions('operator-roy', PARKING_DEMO)).toBeNull();
  });
});

describe('confirming the presence of a vehicle in Postgres', () => {
  it('locks the lot, then the session, then records the check, clears the flag and logs the event in one transaction', async () => {
    const scripted = lockedLot().answer('lock-session-to-confirm', [{ flagged: true }]).answer('confirm-presence', [{ id: SESSION_ID }]);

    expect(await repositoryOn(scripted).confirmPresence(SOPHIE_OPERATOR, check)).toBe('CONFIRMED');

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'lock-session-to-confirm', 'confirm-presence', 'append-session-event']);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.statement('lock-session-to-confirm')?.text).toMatch(/where id = \$1 and lot_id = \$2 and state in \([^)]*\)\s+for update/);
    const update = scripted.statement('confirm-presence');
    expect(update?.text).toMatch(/set presence_confirmed_at = \$1::timestamptz, presence_confirmed_by = \$2, stale_flagged_at = null\s+where id = \$3 and lot_id = \$4/);
    expect(update?.params).toEqual([CONFIRMED_AT.toISOString(), SOPHIE_ID, SESSION_ID, PARKING_DEMO]);
    expect(update?.text).not.toMatch(/state =|payment|captured|exit_at/);
  });

  it('logs PRESENCE_CONFIRMED with an empty payload, dated by the column the check wrote, and never the member', async () => {
    const scripted = lockedLot().answer('lock-session-to-confirm', [{ flagged: true }]).answer('confirm-presence', [{ id: SESSION_ID }]);

    await repositoryOn(scripted).confirmPresence(SOPHIE_OPERATOR, check);

    const event = onlyAppendedSessionEvent(scripted);
    expect([event.kind, event.payload]).toEqual(['PRESENCE_CONFIRMED', {}]);
    expect(event.occurredAtText).toContain('presence_confirmed_at');
    expect(JSON.stringify(appendedSessionEvents(scripted))).not.toContain(SOPHIE_ID);
  });

  it('writes nothing for an open session that is not flagged, so a double click is harmless', async () => {
    const scripted = lockedLot().answer('lock-session-to-confirm', [{ flagged: false }]);

    expect(await repositoryOn(scripted).confirmPresence(SOPHIE_OPERATOR, check)).toBe('CONFIRMED');
    expect(scripted.count('confirm-presence')).toBe(0);
    expect(scripted.count('append-session-event')).toBe(0);
  });

  it('refuses a session that is closed or not in the lot as SESSION_NOT_FOUND, writing nothing', async () => {
    const scripted = lockedLot();

    expect(await repositoryOn(scripted).confirmPresence(SOPHIE_OPERATOR, check)).toBe('SESSION_NOT_FOUND');
    expect(scripted.count('confirm-presence')).toBe(0);
  });

  it("refuses another operator's lot before reading any session", async () => {
    const scripted = new ScriptedSql();

    expect(await repositoryOn(scripted).confirmPresence('operator-roy', check)).toBe('LOT_NOT_FOUND');
    expect(scripted.count('lock-session-to-confirm')).toBe(0);
  });

  it('answers LOT_BUSY when the lot lock times out', async () => {
    const scripted = new ScriptedSql().fail('lock-owned-lot', LOCK_NOT_AVAILABLE);

    expect(await repositoryOn(scripted).confirmPresence(SOPHIE_OPERATOR, check)).toBe('LOT_BUSY');
  });
});

describe('closing a stale session at its last proof in Postgres (story #75)', () => {
  const CLOSED_AT = new Date('2026-11-12T10:30:00Z');
  const closing = { lotId: PARKING_DEMO, sessionId: SESSION_ID, memberId: SOPHIE_ID, closedAt: CLOSED_AT };
  const LAST_PROOF = `greatest(parking_session.entry_confirmed_at, case when parking_session.presumed_by = 'WALK' then parking_session.parked_at end, parking_session.parked_answered_at, parking_session.presence_confirmed_at)`;
  const closedRow = { assigned_spot_id: 'spot-a1', confirmed_spot_id: null, payment_intent_id: 'pi_julie' };
  const julieSpotOccupied = { id: 'spot-a1', state: 'OCCUPIED', held_by_another_session: false };

  function closedJulie(row: Record<string, unknown> = closedRow): ScriptedSql {
    return lockedLot().answer('close-at-last-proof', [row]).answer('lock-exit-spots', [julieSpotOccupied]);
  }

  function oneLine(text: string | undefined): string {
    return (text ?? '').replace(/\s+/g, ' ');
  }

  it('locks the lot, closes the session, frees and flags its spot and logs the step, in one transaction', async () => {
    const scripted = closedJulie();

    expect(await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing)).toEqual({ paymentIntentId: 'pi_julie' });

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'close-at-last-proof', 'lock-exit-spots', 'free-exit-spots', 'flag-closed-spot-to-check', 'append-session-event']);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
  });

  it('closes only an active flagged session of the lot with a proof, at that proof, as a staff exit by the member', async () => {
    const scripted = closedJulie();

    await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing);

    const update = scripted.statement('close-at-last-proof');
    const text = oneLine(update?.text);
    expect(text).toContain(`set state = 'CLOSED_BY_STAFF', exit_at = ${LAST_PROOF}, exit_identification = 'STAFF', staff_closed_by = $1, stale_flagged_at = null`);
    expect(text).toContain(`where id = $2 and lot_id = $3 and state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED') and stale_flagged_at is not null and ${LAST_PROOF} is not null`);
    expect(update?.params).toEqual([SOPHIE_ID, SESSION_ID, PARKING_DEMO]);
  });

  it('marks the card hold for release in the same write and touches no amount, so nothing is captured', async () => {
    const scripted = closedJulie();

    await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing);

    const text = oneLine(scripted.statement('close-at-last-proof')?.text);
    expect(text).toContain('hold_release_pending = payment_intent_id is not null');
    expect(scripted.statements.map(({ text: statement }) => statement).join(' ')).not.toMatch(/captured_cents|pending_capture_cents|surplus_paid_cents|unpaid_cents/);
  });

  it('frees the spot the car stood in, confirmed before assigned, and flags it to check as a stale session, keeping an earlier flag', async () => {
    const scripted = lockedLot()
      .answer('close-at-last-proof', [{ ...closedRow, confirmed_spot_id: 'spot-a2' }])
      .answer('lock-exit-spots', [{ id: 'spot-a2', state: 'OCCUPIED', held_by_another_session: false }]);

    await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing);

    expect(scripted.statement('free-exit-spots')?.params).toContain('spot-a2');
    const flag = scripted.statement('flag-closed-spot-to-check');
    const text = oneLine(flag?.text);
    expect(text).toContain('set needs_check = true, needs_check_since = coalesce(needs_check_since, $1::timestamptz), needs_check_reason = coalesce(needs_check_reason, \'STALE_SESSION\')');
    expect(text).toContain("where id = $2 and state = 'AVAILABLE'");
    expect(flag?.params).toEqual([CLOSED_AT.toISOString(), 'spot-a2']);
  });

  it('logs CLOSED_BY_STAFF with an empty payload, dated by the exit the update wrote, and never the member', async () => {
    const scripted = closedJulie();

    await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing);

    const event = onlyAppendedSessionEvent(scripted);
    expect([event.kind, event.payload]).toEqual(['CLOSED_BY_STAFF', {}]);
    expect(event.occurredAtText).toContain('exit_at');
    expect(JSON.stringify(appendedSessionEvents(scripted))).not.toContain(SOPHIE_ID);
  });

  it('answers no hold to cancel for a session that had none', async () => {
    const scripted = closedJulie({ ...closedRow, payment_intent_id: null });

    expect(await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing)).toEqual({ paymentIntentId: null });
  });

  it('refuses a session no longer active, no longer flagged or not in the lot as SESSION_NOT_FOUND, freeing and logging nothing', async () => {
    const scripted = lockedLot();

    expect(await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing)).toBe('SESSION_NOT_FOUND');
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'close-at-last-proof']);
  });

  it("refuses another operator's lot before touching any session", async () => {
    const scripted = new ScriptedSql();

    expect(await repositoryOn(scripted).closeAtLastProof('operator-roy', closing)).toBe('LOT_NOT_FOUND');
    expect(scripted.count('close-at-last-proof')).toBe(0);
  });

  it('answers LOT_BUSY when the lot lock times out, closing nothing', async () => {
    const scripted = new ScriptedSql().fail('lock-owned-lot', LOCK_NOT_AVAILABLE);

    expect(await repositoryOn(scripted).closeAtLastProof(SOPHIE_OPERATOR, closing)).toBe('LOT_BUSY');
    expect(scripted.count('close-at-last-proof')).toBe(0);
  });
});
