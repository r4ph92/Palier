import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import type { SpotAnswer } from '../../src/domain/parkingSessions/ParkedAnswer.ts';
import type { SpotState } from '../../src/domain/spots/spotStates.ts';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const MARC_ID = '00000000-0000-4000-8000-000000000502';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000101';
const SPOT_B3_ID = '00000000-0000-4000-8000-0000000003b3';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const B3 = { number: 'B-3', levelCode: 'P1', aisleCode: 'B' };
const NO_CONFIRMED_SPOT = { assigned_spot_id: SPOT_A1_ID, number: null, aisle_code: null, level_code: null };

const julieAnswersB3: SpotAnswer = { sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'B-3' };

function spotRow(state: SpotState, number = 'B-3') {
  return { id: SPOT_B3_ID, state, number, aisle_code: number.charAt(0), level_code: 'P1' };
}

function asked(spotState: SpotState | null = 'AVAILABLE', sessionState: EntrySessionState = 'PARKED_UNCONFIRMED') {
  return askedAmong(spotState === null ? [] : [spotRow(spotState)], sessionState);
}

function askedAmong(spotRows: readonly ReturnType<typeof spotRow>[], sessionState: EntrySessionState = 'PARKED_UNCONFIRMED') {
  return new ScriptedSql()
    .answer('read-session-lot', [{ lot_id: LOT_ID }])
    .answer('lock-answering-session', [{ state: sessionState, ...NO_CONFIRMED_SPOT }])
    .answer('lock-answered-spot', spotRows)
    .answer('occupy-answered-spot', [{ id: SPOT_B3_ID }])
    .answer('confirm-parked-spot', [{ id: SESSION_ID }]);
}

function answerWith(sql: ScriptedSql, answer: SpotAnswer = julieAnswersB3) {
  return new PostgresParkedAnswerRepository(sql.database()).answer(answer);
}

const WRITES = ['occupy-answered-spot', 'confirm-parked-spot'] as const;

describe('PostgresParkedAnswerRepository (story #21)', () => {
  it('places Julie in B-3 under the lot lock: lot, session, spot, then the spot write before the session write', async () => {
    const sql = asked();

    await expect(answerWith(sql)).resolves.toEqual({ outcome: 'confirmed', spot: B3 });

    expect(sql.labels()).toEqual(['read-session-lot', 'limit-lock-wait', 'lock-lot', 'lock-answering-session', 'lock-answered-spot', ...WRITES]);
    expect(sql.statements.slice(1).every((statement) => statement.onTransaction)).toBe(true);
    expect(sql.isolationLevels).toEqual(['read committed']);
    expect(sql.statement('lock-lot')?.params).toEqual([LOT_ID]);
  });

  it('locks only her own session, and looks the number up in its lot alone', async () => {
    const sql = asked();

    await answerWith(sql);

    expect(sql.statement('read-session-lot')?.params).toEqual([SESSION_ID, JULIE_ID]);
    expect(sql.statement('lock-answering-session')?.text).toMatch(/where ps\.id = \$\d+ and ps\.user_id = \$\d+\s+for update of ps/);
    const lookup = sql.statement('lock-answered-spot');
    expect(lookup?.text).toMatch(/where spot\.lot_id = \$\d+ and upper\(regexp_replace\("spot"\."number", '\[\[:space:\]–—-\]', '', 'g'\)\) = \$\d+/);
    expect(lookup?.text).toMatch(/order by spot\.number\s+for update of spot/);
    expect(lookup?.text).not.toMatch(/limit/);
    expect(lookup?.params).toEqual([LOT_ID, 'B3']);
  });

  it('places no car for « b12 » between B12 and B1-2, both free, and writes nothing', async () => {
    const sql = askedAmong([spotRow('AVAILABLE', 'B1-2'), spotRow('AVAILABLE', 'B12')]);

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'b12' })).resolves.toEqual({ outcome: 'unknown-spot' });
    expect(sql.count('occupy-answered-spot')).toBe(0);
    expect(sql.count('confirm-parked-spot')).toBe(0);
  });

  it('places Julie in B12 between B12 and B1-2 when she sends « B12 » as painted', async () => {
    const sql = askedAmong([spotRow('AVAILABLE', 'B1-2'), spotRow('AVAILABLE', 'B12')]);

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'B12' })).resolves.toMatchObject({ outcome: 'confirmed', spot: { number: 'B12' } });
  });

  it('makes B-3 occupied without a check flag, and records it as the real spot with the answer time', async () => {
    const sql = asked();

    await answerWith(sql);

    const occupy = sql.statement('occupy-answered-spot');
    expect(occupy?.text).toMatch(/set state = 'OCCUPIED', needs_check = false, state_changed_at = now\(\)\s+where id = \$\d+ and state in \('AVAILABLE', 'OCCUPIED_UNKNOWN'\)/);
    const confirm = sql.statement('confirm-parked-spot');
    expect(confirm?.text).toMatch(/set state = 'PARKED_CONFIRMED', confirmed_spot_id = \$\d+, parked_answered_at = now\(\)/);
    expect(confirm?.text).toMatch(/where id = \$\d+ and state in \('PARKED_UNCONFIRMED', 'PARKED_PRESUMED'\)/);
    expect(confirm?.params).toEqual([SPOT_B3_ID, SESSION_ID]);
  });

  it('takes back her own assigned spot A-1, occupied-unknown since the walk, through the same path', async () => {
    const sql = askedAmong([spotRow('OCCUPIED_UNKNOWN', 'A-1')]);

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'A-1' })).resolves.toMatchObject({ outcome: 'confirmed' });
    expect(sql.count('occupy-answered-spot')).toBe(1);
  });

  it.each([
    ['assigned to Marc', 'ASSIGNED', 'spot-taken'],
    ['held for another driver', 'HELD', 'spot-taken'],
    ['occupied', 'OCCUPIED', 'spot-taken'],
    ['out of service', 'OUT_OF_SERVICE', 'spot-out-of-service'],
  ] as const)('refuses a spot %s without any write', async (_case, spotState, outcome) => {
    const sql = asked(spotState);

    await expect(answerWith(sql)).resolves.toEqual({ outcome });
    expect(WRITES.map((label) => sql.count(label))).toEqual([0, 0]);
  });

  it('refuses a number this lot does not have, another lot\'s included, without any write', async () => {
    const sql = asked(null);

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'C-1' })).resolves.toEqual({ outcome: 'unknown-spot' });
    expect(WRITES.map((label) => sql.count(label))).toEqual([0, 0]);
  });

  it('answers SPOT_TAKEN, not a failure, when Marc names B-3 after Julie confirmed it', async () => {
    const sql = asked('OCCUPIED');

    await expect(answerWith(sql, { sessionId: SESSION_ID, driverId: MARC_ID, spotNumber: 'B-3' })).resolves.toEqual({ outcome: 'spot-taken' });
  });

  it("answers not found, without a lock, for an unknown id or another driver's session", async () => {
    const sql = new ScriptedSql();

    await expect(answerWith(sql, { ...julieAnswersB3, driverId: MARC_ID })).resolves.toEqual({ outcome: 'not-found' });
    expect(sql.labels()).toEqual(['read-session-lot']);
  });

  it('answers the first spot again, without a spot read, once Julie already answered', async () => {
    const sql = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_CONFIRMED', assigned_spot_id: SPOT_A1_ID, number: 'B-3', aisle_code: 'B', level_code: 'P1' }]);

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'B-5' })).resolves.toEqual({ outcome: 'already', spot: B3 });
    expect(sql.count('lock-answered-spot')).toBe(0);
  });

  it.each([
    ['still waiting for its loop', 'CREATED', 'not-asked'],
    ['confirmed at the entry only', 'ENTRY_CONFIRMED', 'not-asked'],
    ['cancelled', 'CANCELLED', 'closed'],
  ] as const)('refuses a session %s without a spot read', async (_case, sessionState, outcome) => {
    const sql = asked('AVAILABLE', sessionState);

    await expect(answerWith(sql)).resolves.toEqual({ outcome });
    expect(sql.count('lock-answered-spot')).toBe(0);
  });

  it('answers lot-busy when the lot stays locked past the lock timeout', async () => {
    const sql = asked().fail('lock-lot', LOCK_NOT_AVAILABLE);

    await expect(answerWith(sql)).resolves.toEqual({ outcome: 'lot-busy' });
  });

  it('fails, rolling the answer back, when the session write finds nothing to confirm', async () => {
    const withoutConfirm = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_UNCONFIRMED', ...NO_CONFIRMED_SPOT }])
      .answer('lock-answered-spot', [spotRow('AVAILABLE')])
      .answer('occupy-answered-spot', [{ id: SPOT_B3_ID }]);

    await expect(answerWith(withoutConfirm)).rejects.toThrow(`Session ${SESSION_ID} was no longer waiting for its answer.`);
  });

  it('fails when the spot read as free could not be occupied', async () => {
    const sql = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_UNCONFIRMED', ...NO_CONFIRMED_SPOT }])
      .answer('lock-answered-spot', [spotRow('AVAILABLE')]);

    await expect(answerWith(sql)).rejects.toThrow(`Answered spot ${SPOT_B3_ID} could not be occupied.`);
    expect(sql.count('confirm-parked-spot')).toBe(0);
  });
});

describe('PostgresParkedAnswerRepository correcting a presumed spot (story #22)', () => {
  const SPOT_A3_ID = '00000000-0000-4000-8000-0000000003a3';
  const julieCorrectsToA3: SpotAnswer = { ...julieAnswersB3, spotNumber: 'A-3' };
  const CORRECTION_WRITES = ['occupy-answered-spot', 'flag-assigned-spot', 'confirm-parked-spot'] as const;

  function presumedNaming(spot: { readonly id: string; readonly state: SpotState; readonly number: string }) {
    return new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_PRESUMED', ...NO_CONFIRMED_SPOT }])
      .answer('lock-answered-spot', [{ ...spot, aisle_code: 'A', level_code: 'P1' }])
      .answer('occupy-answered-spot', [{ id: spot.id }])
      .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }])
      .answer('confirm-parked-spot', [{ id: SESSION_ID }]);
  }

  it('moves Julie from A-1 to A-3 in one transaction: lot, session, A-3 locked and occupied, A-1 flagged, then the session', async () => {
    const sql = presumedNaming({ id: SPOT_A3_ID, state: 'AVAILABLE', number: 'A-3' });

    await expect(answerWith(sql, julieCorrectsToA3)).resolves.toEqual({ outcome: 'confirmed', spot: { number: 'A-3', levelCode: 'P1', aisleCode: 'A' } });

    expect(sql.labels()).toEqual(['read-session-lot', 'limit-lock-wait', 'lock-lot', 'lock-answering-session', 'lock-answered-spot', ...CORRECTION_WRITES]);
    expect(sql.statements.slice(1).every((statement) => statement.onTransaction)).toBe(true);
    expect(sql.statement('lock-answering-session')?.text).toMatch(/select ps\.state, ps\.assigned_spot_id/);
    expect(sql.statement('occupy-answered-spot')?.params).toEqual([SPOT_A3_ID]);
    expect(sql.statement('flag-assigned-spot')?.text).toMatch(/set state = 'OCCUPIED_UNKNOWN', needs_check = true[\s\S]*where id = \$\d+ and state = 'OCCUPIED'/);
    expect(sql.statement('flag-assigned-spot')?.params).toEqual([SPOT_A1_ID]);
    expect(sql.statement('confirm-parked-spot')?.params).toEqual([SPOT_A3_ID, SESSION_ID]);
  });

  it('confirms the presumption on A-1, without any spot write, when Julie names A-1 itself', async () => {
    const sql = presumedNaming({ id: SPOT_A1_ID, state: 'OCCUPIED', number: 'A-1' });

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'A-1' })).resolves.toMatchObject({ outcome: 'confirmed', spot: { number: 'A-1' } });

    expect(sql.count('occupy-answered-spot')).toBe(0);
    expect(sql.count('flag-assigned-spot')).toBe(0);
    expect(sql.statement('confirm-parked-spot')?.params).toEqual([SPOT_A1_ID, SESSION_ID]);
  });

  // A presumed spot moved out of OCCUPIED by hand must not be confirmed as is, or a later driver naming it fails on the confirmed-spot index.
  it('occupies A-1 again, clearing its check flag, before confirming Julie on it when it left OCCUPIED', async () => {
    const sql = presumedNaming({ id: SPOT_A1_ID, state: 'OCCUPIED_UNKNOWN', number: 'A-1' });

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'A-1' })).resolves.toMatchObject({ outcome: 'confirmed', spot: { number: 'A-1' } });

    expect(sql.labels().slice(-2)).toEqual(['occupy-answered-spot', 'confirm-parked-spot']);
    expect(sql.statement('occupy-answered-spot')?.params).toEqual([SPOT_A1_ID]);
    expect(sql.count('flag-assigned-spot')).toBe(0);
  });

  it('refuses A-3 occupied by another driver without any write', async () => {
    const sql = presumedNaming({ id: SPOT_A3_ID, state: 'OCCUPIED', number: 'A-3' });

    await expect(answerWith(sql, julieCorrectsToA3)).resolves.toEqual({ outcome: 'spot-taken' });
    expect(CORRECTION_WRITES.map((label) => sql.count(label))).toEqual([0, 0, 0]);
  });

  it('fails, rolling A-3 back, when the presumed A-1 was no longer occupied', async () => {
    const sql = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_PRESUMED', ...NO_CONFIRMED_SPOT }])
      .answer('lock-answered-spot', [{ id: SPOT_A3_ID, state: 'AVAILABLE', number: 'A-3', aisle_code: 'A', level_code: 'P1' }])
      .answer('occupy-answered-spot', [{ id: SPOT_A3_ID }]);

    await expect(answerWith(sql, julieCorrectsToA3)).rejects.toThrow(`Assigned spot ${SPOT_A1_ID} of a session leaving it was not occupied.`);
    expect(sql.count('confirm-parked-spot')).toBe(0);
  });
});
