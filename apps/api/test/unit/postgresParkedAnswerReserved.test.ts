import { describe, expect, it } from 'vitest';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { NO_FLAGS_ROW, STANDARD_VEHICLE_ROW } from './fakes/answerRows.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000101';
const SPOT_B5_ID = '00000000-0000-4000-8000-0000000003b5';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const AISLE_A_ID = '00000000-0000-4000-8000-0000000002a1';
const NO_CONFIRMED_SPOT = { assigned_spot_id: SPOT_A1_ID, assigned_aisle_id: AISLE_A_ID, assigned_spot_state: 'OCCUPIED', number: null, aisle_code: null, level_code: null };
const answerB5 = { sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'B-5' };

describe('PostgresParkedAnswerRepository refusing a reserved spot (story #125)', () => {
  const ELECTRIC_WITH_PERMIT_ROW = { is_electric: true, has_accessible_permit: true, is_oversize: false };
  const accessibleB5 = { id: SPOT_B5_ID, aisle_id: AISLE_A_ID, state: 'AVAILABLE', number: 'B-5', aisle_code: 'B', level_code: 'P1', ...NO_FLAGS_ROW, is_accessible: true };

  function askedForB5(vehicleRow: typeof STANDARD_VEHICLE_ROW) {
    return new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_UNCONFIRMED', ...NO_CONFIRMED_SPOT, ...vehicleRow }])
      .answer('lock-answered-spot', [accessibleB5])
      .answer('occupy-answered-spot', [{ id: SPOT_B5_ID }])
      .answer('confirm-parked-spot', [{ id: SESSION_ID }]);
  }

  it('refuses a standard vehicle the accessible B-5 before any write', async () => {
    const sql = askedForB5(STANDARD_VEHICLE_ROW);

    await expect(new PostgresParkedAnswerRepository(sql.database()).answer(answerB5)).resolves.toEqual({ outcome: 'spot-not-suitable' });

    expect(sql.labels()).toEqual(['read-session-lot', 'limit-lock-wait', 'lock-lot', 'lock-answering-session', 'lock-answered-spot']);
  });

  it('places a vehicle with a permit on the accessible B-5', async () => {
    const sql = askedForB5(ELECTRIC_WITH_PERMIT_ROW);

    await expect(new PostgresParkedAnswerRepository(sql.database()).answer(answerB5)).resolves.toMatchObject({ outcome: 'confirmed' });
  });

  it("reads the needs frozen on the session at entry and the spot's flags under the existing locks", async () => {
    const sql = askedForB5(STANDARD_VEHICLE_ROW);

    await new PostgresParkedAnswerRepository(sql.database()).answer(answerB5);

    const sessionText = sql.statement('lock-answering-session')?.text;
    expect(sessionText).toMatch(/ps\.is_electric, ps\.has_accessible_permit, ps\.is_oversize/);
    expect(sessionText).not.toMatch(/\bvehicle\b/);
    expect(sessionText).toMatch(/for update of ps, assigned$/);
    expect(sql.statement('lock-answered-spot')?.text).toMatch(/spot\.is_ev, spot\.is_accessible, spot\.is_oversize/);
  });
});
