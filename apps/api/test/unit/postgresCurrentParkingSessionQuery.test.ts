import type { ActiveEntrySessionState } from '@palier/shared-types';
import { exitBeaconWindow } from '../../src/domain/exits/identifyByBeacon.ts';
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
    is_electric: false,
    has_accessible_permit: false,
    is_oversize: false,
  };
}

function freeSpotRow(number: string, flags: Partial<Record<'is_ev' | 'is_accessible' | 'is_oversize', boolean>> = {}) {
  return { code: 'B', number, is_ev: false, is_accessible: false, is_oversize: false, ...flags };
}

function readWith(sql: ScriptedSql) {
  return new PostgresCurrentParkingSessionQuery(sql.database(), exitBeaconWindow).findCurrentParkingSessionForUser(JULIE_ID);
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
      .answer('read-parked-question', [freeSpotRow('B-1'), freeSpotRow('B-3')]);

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
      .answer('read-parked-question', [{ code: 'B', number: null, is_ev: null, is_accessible: null, is_oversize: null }]);

    expect((await readWith(sql))?.question).toEqual({ aisleCode: 'B', freeSpotNumbers: [] });
  });

  it.each(['ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_CONFIRMED'] as const)('asks nothing, and reads no aisle, for a session %s', async (state) => {
    const sql = new ScriptedSql().answer('read-current-session', [sessionRow(state, AISLE_B_ID)]);

    expect((await readWith(sql))?.question).toBeNull();
    expect(sql.count('read-parked-question')).toBe(0);
  });
});

describe('PostgresCurrentParkingSessionQuery, free spots for the vehicle (story #23)', () => {
  const aisleBSpots = [freeSpotRow('B-1'), freeSpotRow('B-4', { is_oversize: true }), freeSpotRow('B-5', { is_accessible: true }), freeSpotRow('B-6', { is_ev: true })];

  function askedWith(needs: Partial<Record<'is_electric' | 'has_accessible_permit' | 'is_oversize', boolean>>) {
    return new ScriptedSql()
      .answer('read-current-session', [{ ...sessionRow('PARKED_UNCONFIRMED', AISLE_B_ID), ...needs }])
      .answer('read-parked-question', aisleBSpots);
  }

  it('lists only the spots a standard car fits: no accessible or electric spot', async () => {
    expect((await readWith(askedWith({})))?.question?.freeSpotNumbers).toEqual(['B-1', 'B-4']);
  });

  it('lists the electric spot to an electric car, and the accessible one to a permit holder', async () => {
    expect((await readWith(askedWith({ is_electric: true })))?.question?.freeSpotNumbers).toEqual(['B-1', 'B-4', 'B-6']);
    expect((await readWith(askedWith({ has_accessible_permit: true })))?.question?.freeSpotNumbers).toEqual(['B-1', 'B-4', 'B-5']);
  });

  it('lists only oversize spots to an oversize vehicle', async () => {
    expect((await readWith(askedWith({ is_oversize: true })))?.question?.freeSpotNumbers).toEqual(['B-4']);
  });

  it("reads the vehicle's needs with the session, standard when the vehicle was deleted", async () => {
    const sql = askedWith({});

    await readWith(sql);

    const text = sql.statement('read-current-session')?.text;
    expect(text).toMatch(/left join vehicle on vehicle\.id = ps\.vehicle_id/);
    expect(text).toMatch(/coalesce\(vehicle\.is_electric, false\) as is_electric/);
    expect(sql.statement('read-parked-question')?.text).toMatch(/spot\.is_ev, spot\.is_accessible, spot\.is_oversize/);
  });
});

describe('PostgresCurrentParkingSessionQuery, the exit beacon fallback (story #49)', () => {
  it.each([
    { read: true, fallback: true },
    { read: false, fallback: false },
    { read: null, fallback: false },
  ])('reads $read as a fallback of $fallback', async ({ read, fallback }) => {
    const sql = new ScriptedSql().answer('read-current-session', [{ ...sessionRow('PARKED_CONFIRMED'), exit_beacon_fallback: read }]);

    expect(await readWith(sql)).toMatchObject({ exitBeaconFallback: fallback });
  });

  it('counts only fresh reports of leavable sessions of the lot, the session\'s own included', async () => {
    const sql = new ScriptedSql().answer('read-current-session', [sessionRow('PARKED_CONFIRMED')]);

    await readWith(sql);

    const text = sql.statements[0]?.text ?? '';
    expect(text).toMatch(/exit_beacon_report report where report\.session_id = ps\.id and report\.reported_at >= now\(\)/);
    expect(text).toMatch(/other\.lot_id = ps\.lot_id and other\.state in/);
    expect(text).toMatch(/\) >= 2/);
  });
});
