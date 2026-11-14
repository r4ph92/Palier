import { describe, expect, it } from 'vitest';
import { PostgresExitRepository } from '../../src/infrastructure/postgres/PostgresExitRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const EXITED_AT = new Date('2026-11-13T15:00:00.000Z');
const LOT_ID = 'lot-demo';
const SPOT_A1_ID = 'spot-a1';

function exitFreeing(spotState: 'OCCUPIED' | 'OCCUPIED_UNKNOWN'): ScriptedSql {
  return new ScriptedSql()
    .answer('close-session', [{ assigned_spot_id: SPOT_A1_ID, confirmed_spot_id: null }])
    .answer('lock-exit-spots', [{ id: SPOT_A1_ID, state: spotState, held_by_another_session: false }]);
}

async function closeWith(sql: ScriptedSql): Promise<void> {
  await new PostgresExitRepository(sql.database()).close({
    sessionId: 'session-julie',
    lotId: LOT_ID,
    exitGateId: 'gate-exit',
    identification: 'APP',
    exit: { exitedAt: EXITED_AT, capturedCents: 500, surplusPaidCents: 0, unpaidCents: 0 },
  });
}

describe('freeing the spots of an exit in Postgres', () => {
  it('stamps the time of the flag when it flags a freed occupied-unknown spot, and keeps the time of a flag already there', async () => {
    const sql = exitFreeing('OCCUPIED_UNKNOWN');

    await closeWith(sql);

    const free = sql.statement('free-exit-spots');
    expect(free?.text).toMatch(/set needs_check = needs_check or state = 'OCCUPIED_UNKNOWN',\s+needs_check_since = coalesce\(needs_check_since, case when state = 'OCCUPIED_UNKNOWN' then \$1::timestamptz end\),\s+state = 'AVAILABLE', state_changed_at = \$2::timestamptz/);
    expect(free?.params).toEqual([EXITED_AT.toISOString(), EXITED_AT.toISOString(), SPOT_A1_ID]);
  });

  it('writes no reason of its own, and leaves the flag columns alone but for that one expression', async () => {
    const sql = exitFreeing('OCCUPIED');

    await closeWith(sql);

    expect(sql.statement('free-exit-spots')?.text).not.toMatch(/needs_check_reason/);
    expect(sql.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'close-session', 'lock-exit-spots', 'free-exit-spots', 'unknown']);
  });
});
