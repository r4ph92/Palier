import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000201';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const SPOT_A3_ID = '00000000-0000-4000-8000-0000000003a3';

const NO_CONFIRMED_SPOT = { number: null, aisle_code: null, level_code: null };
const CONFIRMED_ON_A3 = { number: 'A-3', aisle_code: 'A', level_code: 'P1' };

function answeringSession(state: EntrySessionState, assignedSpotState: string, confirmed = NO_CONFIRMED_SPOT) {
  return { state, assigned_spot_id: SPOT_A1_ID, assigned_spot_state: assignedSpotState, ...confirmed };
}

function answerA3(scripted: ScriptedSql) {
  return new PostgresParkedAnswerRepository(scripted.database()).answer({ sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'A-3' });
}

describe('Julie corrects the spot presumed on foot (story #156, decision 021)', () => {
  function presumedOnA1(): ScriptedSql {
    return new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [answeringSession('PARKED_PRESUMED', 'OCCUPIED')])
      .answer('lock-answered-spot', [{ id: SPOT_A3_ID, state: 'AVAILABLE', ...CONFIRMED_ON_A3 }])
      .answer('occupy-answered-spot', [{ id: SPOT_A3_ID }])
      .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }])
      .answer('confirm-parked-spot', [{ id: SESSION_ID }]);
  }

  it('logs the correction as a confirmed parking on the spot she gave, in the answer transaction', async () => {
    const scripted = presumedOnA1();

    await expect(answerA3(scripted)).resolves.toMatchObject({ outcome: 'confirmed' });

    const confirmed = onlyAppendedSessionEvent(scripted);
    expect(confirmed.kind).toBe('PARKING_CONFIRMED');
    expect(confirmed.payload).toEqual({ spotId: SPOT_A3_ID, spotNumber: 'A-3' });
    expect(confirmed.occurredAtText).toMatch(/select "parked_answered_at" from parking_session where id = \$\d+/);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('confirm-parked-spot'));
    expect(scripted.labels().at(-1)).toBe('append-session-event');
  });
});

describe('an answer that changes nothing (story #156)', () => {
  it('logs nothing more when the same answer comes again once the session is confirmed parked', async () => {
    const scripted = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [answeringSession('PARKED_CONFIRMED', 'OCCUPIED_UNKNOWN', CONFIRMED_ON_A3)]);

    await expect(answerA3(scripted)).resolves.toEqual({ outcome: 'already', spot: { number: 'A-3', aisleCode: 'A', levelCode: 'P1' } });
    expect(scripted.count('append-session-event')).toBe(0);
  });

  it.each(['ENTRY_CONFIRMED', 'CANCELLED', 'CLOSED_PAID'] as const)('logs nothing for an answer to a session %s, which was never asked', async (state) => {
    const scripted = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [answeringSession(state, 'OCCUPIED')]);

    await expect(answerA3(scripted)).resolves.not.toMatchObject({ outcome: 'confirmed' });
    expect(scripted.count('append-session-event')).toBe(0);
  });

  it('logs nothing for a spot number the lot does not know', async () => {
    const scripted = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [answeringSession('PARKED_UNCONFIRMED', 'OCCUPIED_UNKNOWN')]);

    await expect(answerA3(scripted)).resolves.toEqual({ outcome: 'unknown-spot' });
    expect(scripted.count('append-session-event')).toBe(0);
  });

  it("logs nothing for another driver's session, which reads as not found", async () => {
    const scripted = new ScriptedSql();

    await expect(answerA3(scripted)).resolves.toEqual({ outcome: 'not-found' });
    expect(scripted.count('append-session-event')).toBe(0);
  });
});
