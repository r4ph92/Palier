import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import type { SpotTakenReport } from '../../src/domain/parkingSessions/SpotTakenReport.ts';
import type { SpotState } from '../../src/domain/spots/spotStates.ts';
import { PostgresSpotTakenReportRepository } from '../../src/infrastructure/postgres/PostgresSpotTakenReportRepository.ts';
import { freeSpotFixture, freeSpotRowOf } from './fakes/freeSpotFixture.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const MARC_ID = '00000000-0000-4000-8000-000000000502';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000101';
const AISLE_A_ID = '00000000-0000-4000-8000-0000000002a1';
const AISLE_B_ID = '00000000-0000-4000-8000-0000000002b1';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const SPOT_A2_ID = '00000000-0000-4000-8000-0000000003a2';

const julieReportsA1: SpotTakenReport = { sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'A-1' };

function lockedSession(state: EntrySessionState = 'ENTRY_CONFIRMED', assignedSpotState: SpotState = 'OCCUPIED') {
  return {
    state,
    assigned_spot_id: SPOT_A1_ID,
    assigned_spot_number: 'A-1',
    assigned_spot_state: assignedSpotState,
    assigned_aisle_id: AISLE_A_ID,
    is_electric: false,
    has_accessible_permit: false,
    is_oversize: false,
  };
}

function freeSpot(number: string, aisleId: string, distanceToExit: number) {
  return freeSpotRowOf(freeSpotFixture(number, { id: `spot-${number}`, aisleId, distanceToExit }));
}

const A2_FREE = { ...freeSpot('A-2', AISLE_A_ID, 10), id: SPOT_A2_ID };
const A2_CLAIMED = { id: SPOT_A2_ID, number: 'A-2', aisle_code: 'A', level_code: 'P1' };

function reportOn(session = lockedSession(), freeSpots: readonly Record<string, unknown>[] = [A2_FREE, freeSpot('B-1', AISLE_B_ID, 5)]) {
  return new ScriptedSql()
    .answer('read-session-lot', [{ lot_id: LOT_ID }])
    .answer('lock-reporting-session', [session])
    .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }])
    .answer('read-free-spots', freeSpots)
    .answer('claim-spot', [A2_CLAIMED])
    .answer('reassign-spot', [{ id: SESSION_ID }])
    .answer('ask-where-parked', [{ id: SESSION_ID }]);
}

function reportWith(sql: ScriptedSql, report: SpotTakenReport = julieReportsA1) {
  return new PostgresSpotTakenReportRepository(sql.database()).report(report);
}

const WRITES = ['flag-assigned-spot', 'record-reported-spot', 'claim-spot', 'reassign-spot', 'ask-where-parked'] as const;

describe('PostgresSpotTakenReportRepository (story #23)', () => {
  it('moves Julie from A-1 to A-2 in one transaction: lot, session, A-1 flagged and recorded, A-2 claimed, then the session', async () => {
    const sql = reportOn();

    await expect(reportWith(sql)).resolves.toEqual({ outcome: 'reassigned', spot: { number: 'A-2', levelCode: 'P1', aisleCode: 'A' } });

    expect(sql.labels()).toEqual([
      'read-session-lot',
      'limit-lock-wait',
      'lock-lot',
      'lock-reporting-session',
      'flag-assigned-spot',
      'record-reported-spot',
      'read-free-spots',
      'claim-spot',
      'reassign-spot',
    ]);
    expect(sql.statements.slice(1).every((statement) => statement.onTransaction)).toBe(true);
    expect(sql.isolationLevels).toEqual(['read committed']);
  });

  it('locks only her own session with its assigned spot, and reads her vehicle needs, standard without a vehicle', async () => {
    const sql = reportOn();

    await reportWith(sql);

    const lock = sql.statement('lock-reporting-session');
    expect(lock?.text).toMatch(/where ps\.id = \$\d+ and ps\.user_id = \$\d+\s+for update of ps, assigned$/);
    expect(lock?.text).toMatch(/coalesce\(vehicle\.is_electric, false\)/);
    expect(lock?.text).toMatch(/left join vehicle on vehicle\.id = ps\.vehicle_id/);
    expect(lock?.params).toEqual([SESSION_ID, JULIE_ID]);
  });

  it('flags A-1 occupied-unknown to check, and records it as reported for the exit to release', async () => {
    const sql = reportOn();

    await reportWith(sql);

    expect(sql.statement('flag-assigned-spot')?.params).toEqual(['REPORTED_TAKEN', SPOT_A1_ID]);
    const recorded = sql.statement('record-reported-spot');
    expect(recorded?.text).toMatch(/values \(\$\d+, \$\d+, \$\d+\)\s+on conflict do nothing/);
    expect(recorded?.params).toEqual([SESSION_ID, SPOT_A1_ID, LOT_ID]);
  });

  it('claims A-2 occupied, though aisle B has a spot nearer the exit, and moves the session onto it', async () => {
    const sql = reportOn();

    await reportWith(sql);

    expect(sql.statement('claim-spot')?.params).toEqual([SPOT_A2_ID, 'OCCUPIED']);
    expect(sql.statement('claim-spot')?.text).not.toMatch(/needs_check/);
    const reassign = sql.statement('reassign-spot');
    expect(reassign?.text).toMatch(/where id = \$\d+ and state = 'ENTRY_CONFIRMED'/);
    expect(reassign?.params).toEqual([SPOT_A2_ID, SESSION_ID]);
  });

  it('asks Julie where she parked, in the aisle of A-1, when no other spot fits: A-1 flagged and recorded, no spot claimed', async () => {
    const sql = reportOn(lockedSession(), []);

    await expect(reportWith(sql)).resolves.toEqual({ outcome: 'none-free' });

    expect(sql.labels().slice(3)).toEqual(['lock-reporting-session', 'flag-assigned-spot', 'record-reported-spot', 'read-free-spots', 'ask-where-parked']);
    const ask = sql.statement('ask-where-parked');
    expect(ask?.text).toMatch(/set state = 'PARKED_UNCONFIRMED', parked_aisle_id = \$\d+, parked_at = now\(\)\s+where id = \$\d+ and state = 'ENTRY_CONFIRMED'/);
    expect(ask?.params).toEqual([AISLE_A_ID, SESSION_ID]);
  });

  it('asks where she parked when every free spot is lost to other writers', async () => {
    const lostEverySpot = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-reporting-session', [lockedSession()])
      .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }])
      .answer('read-free-spots', [A2_FREE])
      .answer('ask-where-parked', [{ id: SESSION_ID }]);

    await expect(reportWith(lostEverySpot)).resolves.toEqual({ outcome: 'none-free' });
    expect(lostEverySpot.count('claim-spot')).toBe(1);
  });

  it('reassigns without flagging A-1 when an operator moved it out of OCCUPIED before the report', async () => {
    const sql = reportOn(lockedSession('ENTRY_CONFIRMED', 'OCCUPIED_UNKNOWN'));

    await expect(reportWith(sql)).resolves.toMatchObject({ outcome: 'reassigned' });
    expect(sql.count('flag-assigned-spot')).toBe(0);
    expect(sql.count('record-reported-spot')).toBe(1);
  });

  it.each([
    ['parked, presumed', 'PARKED_PRESUMED', 'already-parked'],
    ['parked, asked where', 'PARKED_UNCONFIRMED', 'already-parked'],
    ['parked, confirmed', 'PARKED_CONFIRMED', 'already-parked'],
    ['still waiting for its loop', 'CREATED', 'entry-not-confirmed'],
    ['cancelled', 'CANCELLED', 'closed'],
  ] as const)('refuses a session %s without any write', async (_case, state, outcome) => {
    const sql = reportOn(lockedSession(state));

    await expect(reportWith(sql)).resolves.toEqual({ outcome });
    expect(WRITES.map((label) => sql.count(label))).toEqual([0, 0, 0, 0, 0]);
  });

  it('refuses a report naming a spot that is not her assigned one any more, without any write', async () => {
    const sql = reportOn();

    await expect(reportWith(sql, { ...julieReportsA1, spotNumber: 'A-2' })).resolves.toEqual({ outcome: 'spot-not-assigned' });
    expect(WRITES.map((label) => sql.count(label))).toEqual([0, 0, 0, 0, 0]);
  });

  it("answers not found, without a lock, for Marc reporting Julie's spot", async () => {
    const sql = new ScriptedSql();

    await expect(reportWith(sql, { ...julieReportsA1, driverId: MARC_ID })).resolves.toEqual({ outcome: 'not-found' });
    expect(sql.labels()).toEqual(['read-session-lot']);
    expect(sql.statement('read-session-lot')?.params).toEqual([SESSION_ID, MARC_ID]);
  });

  it('answers lot-busy when the lot stays locked past the lock timeout', async () => {
    const sql = reportOn().fail('lock-lot', LOCK_NOT_AVAILABLE);

    await expect(reportWith(sql)).resolves.toEqual({ outcome: 'lot-busy' });
  });

  it('fails, rolling the report back, when the session write finds nothing to move', async () => {
    const sql = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-reporting-session', [lockedSession()])
      .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }])
      .answer('read-free-spots', [A2_FREE])
      .answer('claim-spot', [A2_CLAIMED]);

    await expect(reportWith(sql)).rejects.toThrow(`Session ${SESSION_ID} was no longer waiting to park.`);
  });

  it('never hands Julie back A-1, the spot she reported, even freed by an operator and nearest the exit', async () => {
    const sql = reportOn(lockedSession('ENTRY_CONFIRMED', 'AVAILABLE'), [{ ...freeSpot('A-1', AISLE_A_ID, 5), id: SPOT_A1_ID }, A2_FREE]);

    await expect(reportWith(sql)).resolves.toMatchObject({ outcome: 'reassigned', spot: { number: 'A-2' } });
    expect(sql.statement('claim-spot')?.params[0]).toBe(SPOT_A2_ID);
  });

  it('reads only free spots no active session holds as assigned or confirmed, which an operator may have set AVAILABLE', async () => {
    const sql = reportOn();

    await reportWith(sql);

    const read = sql.statement('read-free-spots');
    expect(read?.text).toMatch(/s\.state = 'AVAILABLE' and s\.retired_at is null and not exists \(/);
    expect(read?.text).toMatch(/where \(holder\.assigned_spot_id = s\.id or holder\.confirmed_spot_id = s\.id\) and holder\.state in \('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED'\)/);
  });

  it('asks where Julie parked, without claiming, when the read returns no free spot', async () => {
    const sql = reportOn(lockedSession(), []);

    await expect(reportWith(sql)).resolves.toEqual({ outcome: 'none-free' });
    expect(sql.count('claim-spot')).toBe(0);
    expect(sql.count('reassign-spot')).toBe(0);
  });
});
