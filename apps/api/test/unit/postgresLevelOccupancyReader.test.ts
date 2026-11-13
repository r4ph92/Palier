import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { confirmedAssignedSpotOf } from '../../src/infrastructure/postgres/confirmedAssignedSpot.ts';
import { PostgresLevelOccupancyReader } from '../../src/infrastructure/postgres/PostgresLevelOccupancyReader.ts';
import { sql } from 'drizzle-orm';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const OPERATOR = 'operator-lavoie';
const LOT = 'lot-demo';
const lot = { lot_name: 'Parking Démo', vehicle_count: 7 };

function readerOn(scripted: ScriptedSql) {
  return new PostgresLevelOccupancyReader(scripted.database());
}

describe('the Postgres level occupancy reader', () => {
  it('reads the lot in one statement scoped by lot and operator, ordered by level', async () => {
    const scripted = new ScriptedSql().answer('read-level-occupancy', []);

    await readerOn(scripted).readLevelOccupancy(OPERATOR, LOT);

    const read = scripted.statement('read-level-occupancy');
    expect(scripted.labels()).toEqual(['read-level-occupancy']);
    expect(read?.params).toEqual([LOT, OPERATOR]);
    expect(read?.text).toMatch(/where parking_lot\.id = \$1 and parking_lot\.operator_id = \$2/);
    expect(read?.text).toMatch(/left join level on level\.lot_id = parking_lot\.id/);
    expect(read?.text).toMatch(/order by level\.display_order/);
  });

  it('counts an assigned spot only when a session of that spot has its entry confirmed', async () => {
    const text = new PgDialect().sqlToQuery(confirmedAssignedSpotOf(sql.raw('spot.id'))).sql;

    expect(text).toContain("spot.state = 'ASSIGNED'");
    expect(text).toContain('parking_session.assigned_spot_id = spot.id');
    expect(text).toContain("parking_session.state = 'ENTRY_CONFIRMED'");
  });

  it('returns null when no row answers: an unknown lot or another operator\'s', async () => {
    expect(await readerOn(new ScriptedSql()).readLevelOccupancy(OPERATOR, LOT)).toBeNull();
  });

  it('fills the states a level has no spot in with zero and sums the confirmed assigned spots', async () => {
    const scripted = new ScriptedSql().answer('read-level-occupancy', [
      { ...lot, level_code: 'P1', state: 'AVAILABLE', spot_count: 3, confirmed_assigned_count: 0 },
      { ...lot, level_code: 'P1', state: 'ASSIGNED', spot_count: 2, confirmed_assigned_count: 1 },
      { ...lot, level_code: 'P2', state: 'OCCUPIED', spot_count: 4, confirmed_assigned_count: 0 },
    ]);

    const occupancy = await readerOn(scripted).readLevelOccupancy(OPERATOR, LOT);

    expect(occupancy).toEqual({
      lotName: 'Parking Démo',
      vehicleCount: 7,
      levels: [
        { code: 'P1', counts: { AVAILABLE: 3, HELD: 0, ASSIGNED: 2, OCCUPIED: 0, OCCUPIED_UNKNOWN: 0, OUT_OF_SERVICE: 0 } },
        { code: 'P2', counts: { AVAILABLE: 0, HELD: 0, ASSIGNED: 0, OCCUPIED: 4, OCCUPIED_UNKNOWN: 0, OUT_OF_SERVICE: 0 } },
      ],
      confirmedAssignedCount: 1,
    });
  });

  it('keeps a level with no spot, and a lot with no level', async () => {
    const withEmptyLevel = new ScriptedSql().answer('read-level-occupancy', [{ ...lot, level_code: 'P1', state: null, spot_count: 0, confirmed_assigned_count: 0 }]);
    const withoutLevel = new ScriptedSql().answer('read-level-occupancy', [{ ...lot, level_code: null, state: null, spot_count: 0, confirmed_assigned_count: 0 }]);

    const empty = await readerOn(withEmptyLevel).readLevelOccupancy(OPERATOR, LOT);
    const none = await readerOn(withoutLevel).readLevelOccupancy(OPERATOR, LOT);

    expect(empty?.levels).toEqual([{ code: 'P1', counts: { AVAILABLE: 0, HELD: 0, ASSIGNED: 0, OCCUPIED: 0, OCCUPIED_UNKNOWN: 0, OUT_OF_SERVICE: 0 } }]);
    expect(none?.levels).toEqual([]);
  });
});
