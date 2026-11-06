import type { ActiveEntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import { PostgresCurrentParkingSessionQuery } from '../../src/infrastructure/postgres/PostgresCurrentParkingSessionQuery.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const AISLE_B_ID = '00000000-0000-4000-8000-0000000002b1';

function sessionRow(state: ActiveEntrySessionState, parkedAisleId: string | null = null) {
  return {
    id: 'session-1',
    state,
    entry_scan_at: '2026-11-04T23:02:00.000Z',
    pricing_increment_cents: 75,
    pricing_increment_minutes: 15,
    pricing_daily_cap_cents: 2500,
    parked_aisle_id: parkedAisleId,
    lot_name: 'Parking Démo',
    beacon_major: 1,
    number: 'A-1',
    aisle_code: 'A',
    level_code: 'P1',
    level_id: 'level-p1',
  };
}

function readWith(sql: ScriptedSql) {
  return new PostgresCurrentParkingSessionQuery(sql.database()).findCurrentParkingSessionForUser(JULIE_ID);
}

describe('PostgresCurrentParkingSessionQuery, the spot and the question (story #21)', () => {
  it('reads the spot the driver answered, and the assigned one until then', async () => {
    const sql = new ScriptedSql().answer('read-current-session', [sessionRow('PARKED_CONFIRMED')]);

    await readWith(sql);

    expect(sql.statements[0]?.text).toMatch(/join spot on spot\.id = coalesce\(ps\.confirmed_spot_id, ps\.assigned_spot_id\)/);
  });

  it('asks where Julie parked with the free spots of aisle B, read in natural order', async () => {
    const sql = new ScriptedSql()
      .answer('read-current-session', [sessionRow('PARKED_UNCONFIRMED', AISLE_B_ID)])
      .answer('read-parked-question', [
        { code: 'B', number: 'B-1' },
        { code: 'B', number: 'B-3' },
      ]);

    const session = await readWith(sql);

    expect(session?.question).toEqual({ aisleCode: 'B', freeSpotNumbers: ['B-1', 'B-3'] });
    const question = sql.statements.find(({ label }) => label === 'read-parked-question');
    expect(question?.params).toEqual([AISLE_B_ID]);
    expect(question?.text).toMatch(/spot\.state = 'AVAILABLE'/);
    expect(question?.text).toMatch(/order by length\(spot\.number\), spot\.number/);
  });

  it('asks with an empty list when aisle B has no free spot', async () => {
    const sql = new ScriptedSql()
      .answer('read-current-session', [sessionRow('PARKED_UNCONFIRMED', AISLE_B_ID)])
      .answer('read-parked-question', [{ code: 'B', number: null }]);

    expect((await readWith(sql))?.question).toEqual({ aisleCode: 'B', freeSpotNumbers: [] });
  });

  it.each(['ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_CONFIRMED'] as const)('asks nothing, and reads no aisle, for a session %s', async (state) => {
    const sql = new ScriptedSql().answer('read-current-session', [sessionRow(state, AISLE_B_ID)]);

    expect((await readWith(sql))?.question).toBeNull();
    expect(sql.count('read-parked-question')).toBe(0);
  });
});
