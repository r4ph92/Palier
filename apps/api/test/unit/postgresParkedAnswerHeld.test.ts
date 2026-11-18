import { describe, expect, it } from 'vitest';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { NO_FLAGS_ROW, STANDARD_VEHICLE_ROW } from './fakes/answerRows.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000101';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const SPOT_B3_ID = '00000000-0000-4000-8000-0000000003b3';
const AISLE_A_ID = '00000000-0000-4000-8000-0000000002a1';
const NO_CONFIRMED_SPOT = { assigned_spot_id: SPOT_A1_ID, assigned_aisle_id: AISLE_A_ID, assigned_spot_state: 'OCCUPIED', number: null, aisle_code: null, level_code: null };
const answerB3 = { sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'B-3' };

describe('PostgresParkedAnswerRepository refusing a spot another session holds (story #130)', () => {
  function askedForB3(heldByOtherSession: boolean) {
    const freeB3 = { id: SPOT_B3_ID, aisle_id: AISLE_A_ID, state: 'AVAILABLE', number: 'B-3', aisle_code: 'B', level_code: 'P1', ...NO_FLAGS_ROW, held_by_other_session: heldByOtherSession };
    return new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_UNCONFIRMED', ...NO_CONFIRMED_SPOT, ...STANDARD_VEHICLE_ROW }])
      .answer('lock-answered-spot', [freeB3])
      .answer('occupy-answered-spot', [{ id: SPOT_B3_ID }])
      .answer('confirm-parked-spot', [{ id: SESSION_ID }]);
  }

  it('refuses a free spot another active session holds as SPOT_TAKEN, without any write', async () => {
    const sql = askedForB3(true);

    await expect(new PostgresParkedAnswerRepository(sql.database()).answer(answerB3)).resolves.toEqual({ outcome: 'spot-taken' });

    expect(sql.labels()).toEqual(['read-session-lot', 'limit-lock-wait', 'lock-lot', 'lock-answering-session', 'lock-answered-spot']);
  });

  it('places the car on a free spot no other session holds, as before', async () => {
    const sql = askedForB3(false);

    await expect(new PostgresParkedAnswerRepository(sql.database()).answer(answerB3)).resolves.toMatchObject({ outcome: 'confirmed' });
  });

  it('looks for the holder among the active sessions other than the answering one', async () => {
    const sql = askedForB3(false);

    await new PostgresParkedAnswerRepository(sql.database()).answer(answerB3);

    expect(sql.statement('lock-answered-spot')?.text).toMatch(/\(holder\.assigned_spot_id = spot\.id or holder\.confirmed_spot_id = spot\.id\) and holder\.id <> \$1 and holder\.state in \('CREATED'.*'PARKED_CONFIRMED'\)\) as held_by_other_session/);
  });
});
