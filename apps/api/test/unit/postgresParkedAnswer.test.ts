import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import type { SpotAnswer } from '../../src/domain/parkingSessions/ParkedAnswer.ts';
import type { SpotState } from '../../src/domain/spots/spotStates.ts';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const MARC_ID = '00000000-0000-4000-8000-000000000502';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000101';
const SPOT_B3_ID = '00000000-0000-4000-8000-0000000003b3';
const LOCK_NOT_AVAILABLE = { code: '55P03' };
const B3 = { number: 'B-3', levelCode: 'P1', aisleCode: 'B' };
const NO_CONFIRMED_SPOT = { number: null, aisle_code: null, level_code: null };

const julieAnswersB3: SpotAnswer = { sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'B-3' };

function spotRow(state: SpotState) {
  return { id: SPOT_B3_ID, state, number: 'B-3', aisle_code: 'B', level_code: 'P1' };
}

function asked(spotState: SpotState | null = 'AVAILABLE', sessionState: EntrySessionState = 'PARKED_UNCONFIRMED') {
  return new ScriptedSql()
    .answer('read-session-lot', [{ lot_id: LOT_ID }])
    .answer('lock-answering-session', [{ state: sessionState, ...NO_CONFIRMED_SPOT }])
    .answer('lock-answered-spot', spotState === null ? [] : [spotRow(spotState)])
    .answer('occupy-answered-spot', [{ id: SPOT_B3_ID }])
    .answer('confirm-parked-spot', [{ id: SESSION_ID }]);
}

function answerWith(sql: ScriptedSql, answer: SpotAnswer = julieAnswersB3) {
  return new PostgresParkedAnswerRepository(sql.database()).answer(answer);
}

function statementOf(sql: ScriptedSql, label: string) {
  return sql.statements.find((statement) => statement.label === label);
}

const WRITES = ['occupy-answered-spot', 'confirm-parked-spot'] as const;

describe('PostgresParkedAnswerRepository (story #21)', () => {
  it('places Julie in B-3 under the lot lock: lot, session, spot, then the spot write before the session write', async () => {
    const sql = asked();

    await expect(answerWith(sql)).resolves.toEqual({ outcome: 'confirmed', spot: B3 });

    expect(sql.labels()).toEqual(['read-session-lot', 'limit-lock-wait', 'lock-lot', 'lock-answering-session', 'lock-answered-spot', ...WRITES]);
    expect(sql.statements.slice(1).every((statement) => statement.onTransaction)).toBe(true);
    expect(sql.isolationLevels).toEqual(['read committed']);
    expect(statementOf(sql, 'lock-lot')?.params).toEqual([LOT_ID]);
  });

  it('locks only her own session, and looks the number up in its lot alone', async () => {
    const sql = asked();

    await answerWith(sql);

    expect(statementOf(sql, 'read-session-lot')?.params).toEqual([SESSION_ID, JULIE_ID]);
    expect(statementOf(sql, 'lock-answering-session')?.text).toMatch(/where ps\.id = \$\d+ and ps\.user_id = \$\d+\s+for update of ps/);
    expect(statementOf(sql, 'lock-answered-spot')?.text).toMatch(/where spot\.lot_id = \$\d+ and spot\.number = \$\d+\s+for update of spot/);
    expect(statementOf(sql, 'lock-answered-spot')?.params).toEqual([LOT_ID, 'B-3']);
  });

  it('makes B-3 occupied without a check flag, and records it as the real spot with the answer time', async () => {
    const sql = asked();

    await answerWith(sql);

    const occupy = statementOf(sql, 'occupy-answered-spot');
    expect(occupy?.text).toMatch(/set state = 'OCCUPIED', needs_check = false, state_changed_at = now\(\)\s+where id = \$\d+ and state in \('AVAILABLE', 'OCCUPIED_UNKNOWN'\)/);
    const confirm = statementOf(sql, 'confirm-parked-spot');
    expect(confirm?.text).toMatch(/set state = 'PARKED_CONFIRMED', confirmed_spot_id = \$\d+, parked_answered_at = now\(\)/);
    expect(confirm?.text).toMatch(/where id = \$\d+ and state = 'PARKED_UNCONFIRMED'/);
    expect(confirm?.params).toEqual([SPOT_B3_ID, SESSION_ID]);
  });

  it('takes back her own assigned spot A-1, occupied-unknown since the walk, through the same path', async () => {
    const sql = asked('OCCUPIED_UNKNOWN');

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
      .answer('lock-answering-session', [{ state: 'PARKED_CONFIRMED', number: 'B-3', aisle_code: 'B', level_code: 'P1' }]);

    await expect(answerWith(sql, { ...julieAnswersB3, spotNumber: 'B-5' })).resolves.toEqual({ outcome: 'already', spot: B3 });
    expect(sql.count('lock-answered-spot')).toBe(0);
  });

  it.each([
    ['still waiting for its loop', 'CREATED', 'not-asked'],
    ['presumed in its assigned spot', 'PARKED_PRESUMED', 'not-asked'],
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
