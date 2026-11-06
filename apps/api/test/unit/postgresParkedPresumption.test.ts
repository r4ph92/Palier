import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import type { WalkingSignal } from '../../src/domain/parkingSessions/ParkedPresumption.ts';
import { PostgresParkedPresumptionRepository } from '../../src/infrastructure/postgres/PostgresParkedPresumptionRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const WALKED_AT = new Date('2026-11-04T18:05:00Z');
const EARLIER_WALK = '2026-11-04T18:04:00.000Z';

const signal: WalkingSignal = { sessionId: SESSION_ID, driverId: JULIE_ID, detectedAt: WALKED_AT };

function presumeWith(sql: ScriptedSql) {
  return new PostgresParkedPresumptionRepository(sql.database()).presume(signal);
}

function unchanged(state: EntrySessionState, parkedAt: string | null = null) {
  return new ScriptedSql().answer('read-unchanged-session', [{ state, parked_at: parkedAt }]);
}

describe('PostgresParkedPresumptionRepository', () => {
  it('turns the session in one statement guarded by its id, its driver and the confirmed entry', async () => {
    const sql = new ScriptedSql().answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);

    await presumeWith(sql);

    const [update] = sql.statements;
    expect(update?.text).toMatch(/where id = \$\d+ and user_id = \$\d+ and state = 'ENTRY_CONFIRMED'/);
    expect(update?.params).toEqual(expect.arrayContaining([SESSION_ID, JULIE_ID]));
  });

  it('keeps the walking instant at or before the database clock, and never before the loop confirmation', async () => {
    const sql = new ScriptedSql().answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);

    await presumeWith(sql);

    expect(sql.statements[0]?.text).toMatch(/parked_at = greatest\(least\(\$\d+::timestamptz, now\(\)\), entry_confirmed_at\)/);
  });

  it('answers presumed with the recorded instant, without a second read and without touching the spot', async () => {
    const sql = new ScriptedSql().answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);

    await expect(presumeWith(sql)).resolves.toEqual({ outcome: 'presumed', parkedAt: WALKED_AT });
    expect(sql.labels()).toEqual(['presume-parked']);
  });

  it('reads the session back by id and driver when nothing changed', async () => {
    const sql = unchanged('CREATED');

    await presumeWith(sql);

    expect(sql.statements[1]?.text).toMatch(/where id = \$\d+ and user_id = \$\d+/);
    expect(sql.statements[1]?.params).toEqual([SESSION_ID, JULIE_ID]);
  });

  it('answers already with the first walk when the session was presumed parked before', async () => {
    await expect(presumeWith(unchanged('PARKED_PRESUMED', EARLIER_WALK))).resolves.toEqual({ outcome: 'already', parkedAt: new Date(EARLIER_WALK) });
  });

  it.each([
    ['still waiting for its entry loop', 'CREATED', 'entry-not-confirmed'],
    ['confirmed by the loop between the update and the read', 'ENTRY_CONFIRMED', 'entry-not-confirmed'],
    ['cancelled', 'CANCELLED', 'closed'],
  ] as const)('refuses a session %s', async (_case, state, outcome) => {
    await expect(presumeWith(unchanged(state))).resolves.toEqual({ outcome });
  });

  it("answers not found for an unknown id or another driver's session", async () => {
    await expect(presumeWith(new ScriptedSql())).resolves.toEqual({ outcome: 'not-found' });
  });
});
