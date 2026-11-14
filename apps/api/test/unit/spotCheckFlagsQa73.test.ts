import { describe, expect, it } from 'vitest';
import type { SpotAnswer } from '../../src/domain/parkingSessions/ParkedAnswer.ts';
import type { WalkingSignal } from '../../src/domain/parkingSessions/ParkedPresumption.ts';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { PostgresParkedPresumptionRepository } from '../../src/infrastructure/postgres/PostgresParkedPresumptionRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const ERIC_ID = '00000000-0000-4000-8000-000000000505';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000201';
const AISLE_A_ID = '00000000-0000-4000-8000-0000000002a1';
const AISLE_B_ID = '00000000-0000-4000-8000-0000000002b1';
const SPOT_A2_ID = '00000000-0000-4000-8000-0000000003a2';
const SPOT_A3_ID = '00000000-0000-4000-8000-0000000003a3';
const SPOT_B4_ID = '00000000-0000-4000-8000-0000000003b4';
const WALKED_AT = new Date('2026-11-14T01:29:06Z');

// Live run 2026-11-14 (qa-feature.log): Éric, presumed in A-2 after a walk seen in aisle A, answered A-3; A-2 was listed as « allée différente ».
function ericPresumedInA2AnswersA3() {
  return new ScriptedSql()
    .answer('read-session-lot', [{ lot_id: LOT_ID }])
    .answer('lock-answering-session', [
      { state: 'PARKED_PRESUMED', assigned_spot_id: SPOT_A2_ID, assigned_aisle_id: AISLE_A_ID, assigned_spot_state: 'OCCUPIED', number: null, aisle_code: null, level_code: null },
    ])
    .answer('lock-answered-spot', [{ id: SPOT_A3_ID, aisle_id: AISLE_A_ID, state: 'AVAILABLE', number: 'A-3', aisle_code: 'A', level_code: 'P1' }])
    .answer('occupy-answered-spot', [{ id: SPOT_A3_ID }])
    .answer('flag-assigned-spot', [{ id: SPOT_A2_ID }])
    .answer('confirm-parked-spot', [{ id: SESSION_ID }]);
}

// Live run 2026-11-14: B-4, already flagged « place signalée prise » since 01:03 and occupied by Éric after his loop, was flagged again by his walk in aisle A.
function ericInFlaggedB4WalksInAisleA() {
  return new ScriptedSql()
    .answer('read-walk-facts', [
      { state: 'ENTRY_CONFIRMED', parked_at: null, lot_id: LOT_ID, assigned_spot_id: SPOT_B4_ID, assigned_aisle_id: AISLE_B_ID, detected_aisle_id: AISLE_A_ID },
    ])
    .answer('ask-where-parked', [{ parked_at: WALKED_AT.toISOString(), assigned_spot_id: SPOT_B4_ID }])
    .answer('flag-assigned-spot', [{ id: SPOT_B4_ID }])
    .answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);
}

describe('spot check flags under attack (QA #73)', () => {
  it('does not tell the operator « allée différente » when the driver parked in another spot of the same aisle', async () => {
    const sql = ericPresumedInA2AnswersA3();
    const answer: SpotAnswer = { sessionId: SESSION_ID, driverId: ERIC_ID, spotNumber: 'A-3' };

    await new PostgresParkedAnswerRepository(sql.database()).answer(answer);

    expect(sql.statement('flag-assigned-spot')?.params).not.toContain('WRONG_AISLE');
    expect(sql.statement('flag-assigned-spot')?.params).toContain('WRONG_SPOT');
  });

  it('keeps the time and reason of the first flag when a spot already flagged is flagged again, so the oldest stays first', async () => {
    const sql = ericInFlaggedB4WalksInAisleA();
    const walk: WalkingSignal = { sessionId: SESSION_ID, driverId: ERIC_ID, detectedAt: WALKED_AT, detectedAisleMinor: 1 };

    await new PostgresParkedPresumptionRepository(sql.database()).presume(walk);

    const flag = sql.statement('flag-assigned-spot')?.text ?? '';
    expect(flag).toMatch(/needs_check_since = coalesce\(needs_check_since, now\(\)\)/);
    expect(flag).toMatch(/needs_check_reason = coalesce\(needs_check_reason, \$\d+\)/);
  });
});
