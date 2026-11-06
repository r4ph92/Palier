import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import type { WalkingSignal } from '../../src/domain/parkingSessions/ParkedPresumption.ts';
import { PostgresParkedPresumptionRepository } from '../../src/infrastructure/postgres/PostgresParkedPresumptionRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000101';
const AISLE_A_ID = '00000000-0000-4000-8000-0000000002a1';
const AISLE_B_ID = '00000000-0000-4000-8000-0000000002b1';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const WALKED_AT = new Date('2026-11-04T18:05:00Z');
const AISLE_B_MINOR = 2;
const LOCK_NOT_AVAILABLE = { code: '55P03' };

const walkInAisleB: WalkingSignal = { sessionId: SESSION_ID, driverId: JULIE_ID, detectedAt: WALKED_AT, detectedAisleMinor: AISLE_B_MINOR };

function factsRow(state: EntrySessionState, detectedAisleId: string | null = AISLE_B_ID, parkedAt: string | null = null) {
  return { state, parked_at: parkedAt, lot_id: LOT_ID, assigned_aisle_id: AISLE_A_ID, detected_aisle_id: detectedAisleId };
}

function julieConfirmedAtA1(detectedAisleId: string | null = AISLE_B_ID) {
  return new ScriptedSql()
    .answer('read-walk-facts', [factsRow('ENTRY_CONFIRMED', detectedAisleId)])
    .answer('ask-where-parked', [{ parked_at: WALKED_AT.toISOString(), assigned_spot_id: SPOT_A1_ID }])
    .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }])
    .answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);
}

function walkWith(sql: ScriptedSql, signal: WalkingSignal = walkInAisleB) {
  return new PostgresParkedPresumptionRepository(sql.database()).presume(signal);
}

function statementOf(sql: ScriptedSql, label: string) {
  return sql.statements.find((statement) => statement.label === label);
}

describe('PostgresParkedPresumptionRepository, a walk in another aisle than the assigned spot (story #21)', () => {
  it('flags A-1 to check and asks where Julie parked in one transaction under the lot lock, session before spot', async () => {
    const sql = julieConfirmedAtA1();

    await expect(walkWith(sql)).resolves.toEqual({ outcome: 'recorded', state: 'PARKED_UNCONFIRMED', parkedAt: WALKED_AT });

    expect(sql.labels()).toEqual(['read-walk-facts', 'limit-lock-wait', 'lock-lot', 'ask-where-parked', 'flag-assigned-spot']);
    expect(sql.statements.slice(1).every((statement) => statement.onTransaction)).toBe(true);
    expect(sql.isolationLevels).toEqual(['read committed']);
    expect(statementOf(sql, 'lock-lot')?.params).toEqual([LOT_ID]);
  });

  it('turns only the confirmed entry of Julie, and keeps the detected aisle and the clamped walking instant', async () => {
    const sql = julieConfirmedAtA1();

    await walkWith(sql);

    const update = statementOf(sql, 'ask-where-parked');
    expect(update?.text).toMatch(/where id = \$\d+ and user_id = \$\d+ and state = 'ENTRY_CONFIRMED'/);
    expect(update?.text).toMatch(/parked_aisle_id = \$\d+/);
    expect(update?.text).toMatch(/parked_at = greatest\(least\(\$\d+::timestamptz, now\(\)\), entry_confirmed_at\)/);
    expect(update?.params).toEqual(expect.arrayContaining([AISLE_B_ID, SESSION_ID, JULIE_ID]));
  });

  it('makes the occupied A-1 occupied-unknown and flagged to check, with the time of the change', async () => {
    const sql = julieConfirmedAtA1();

    await walkWith(sql);

    const flag = statementOf(sql, 'flag-assigned-spot');
    expect(flag?.text).toMatch(/set state = 'OCCUPIED_UNKNOWN', needs_check = true, state_changed_at = now\(\)/);
    expect(flag?.text).toMatch(/where id = \$\d+ and state = 'OCCUPIED'/);
    expect(flag?.params).toEqual([SPOT_A1_ID]);
  });

  it("looks the detected aisle up by its minor in the session's lot, leaving exit lanes out", async () => {
    const sql = julieConfirmedAtA1();

    await walkWith(sql);

    const facts = statementOf(sql, 'read-walk-facts');
    expect(facts?.text).toMatch(/detected\.lot_id = ps\.lot_id and detected\.beacon_minor = \$\d+ and detected\.is_exit_lane = false/);
    expect(facts?.text).toMatch(/where ps\.id = \$\d+ and ps\.user_id = \$\d+/);
    expect(facts?.params).toEqual([AISLE_B_MINOR, SESSION_ID, JULIE_ID]);
  });

  it.each([
    ['the assigned spot aisle', AISLE_A_ID],
    ['a minor the lot does not know, or an exit lane', null],
  ])('presumes A-1 without a lock or a spot write for a walk in %s', async (_case, detectedAisleId) => {
    const sql = julieConfirmedAtA1(detectedAisleId);

    await expect(walkWith(sql)).resolves.toEqual({ outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });
    expect(sql.labels()).toEqual(['read-walk-facts', 'presume-parked']);
  });

  it.each(['PARKED_UNCONFIRMED', 'PARKED_CONFIRMED'] as const)('answers already for a session %s, without a lock or a write', async (state) => {
    const sql = new ScriptedSql().answer('read-walk-facts', [factsRow(state, AISLE_B_ID, WALKED_AT.toISOString())]);

    await expect(walkWith(sql)).resolves.toEqual({ outcome: 'already', state, parkedAt: WALKED_AT });
    expect(sql.labels()).toEqual(['read-walk-facts']);
  });

  it("answers not found for an unknown id or another driver's session, without a lock", async () => {
    const sql = new ScriptedSql();

    await expect(walkWith(sql)).resolves.toEqual({ outcome: 'not-found' });
    expect(sql.labels()).toEqual(['read-walk-facts']);
  });

  it('writes no spot when the session left ENTRY_CONFIRMED before the lock, and classifies it as read back', async () => {
    const sql = new ScriptedSql()
      .answer('read-walk-facts', [factsRow('ENTRY_CONFIRMED')])
      .answer('read-unchanged-session', [{ state: 'PARKED_PRESUMED', parked_at: WALKED_AT.toISOString() }]);

    await expect(walkWith(sql)).resolves.toEqual({ outcome: 'already', state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });
    expect(sql.count('flag-assigned-spot')).toBe(0);
  });

  it('fails, rolling the session back, when the assigned spot is not occupied', async () => {
    const sql = new ScriptedSql()
      .answer('read-walk-facts', [factsRow('ENTRY_CONFIRMED')])
      .answer('ask-where-parked', [{ parked_at: WALKED_AT.toISOString(), assigned_spot_id: SPOT_A1_ID }]);

    await expect(walkWith(sql)).rejects.toThrow(`Assigned spot ${SPOT_A1_ID} of a session walking away was not occupied.`);
  });

  it('answers lot-busy when the lot stays locked past the lock timeout', async () => {
    const sql = julieConfirmedAtA1().fail('lock-lot', LOCK_NOT_AVAILABLE);

    await expect(walkWith(sql)).resolves.toEqual({ outcome: 'lot-busy' });
    expect(sql.count('ask-where-parked')).toBe(0);
  });
});
