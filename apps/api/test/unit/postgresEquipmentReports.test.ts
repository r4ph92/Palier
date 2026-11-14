import { describe, expect, it } from 'vitest';
import { PostgresEquipmentReports } from '../../src/infrastructure/postgres/PostgresEquipmentReports.ts';
import { entreeDemo } from './fakes/gateFixtures.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const at = new Date('2026-11-13T19:05:00Z');
const report = { lotId: entreeDemo.lotId, beaconMinor: 1, percent: 15, reportedAt: at };

describe('equipment reports in Postgres', () => {
  it("stamps only the reporting gate, inside its own lot", async () => {
    const scripted = new ScriptedSql();

    await new PostgresEquipmentReports(scripted.database()).recordHeartbeat(entreeDemo, at);

    const statement = scripted.statement('record-heartbeat');
    expect(statement?.text).toMatch(/update gate set last_heartbeat_at = \$1::timestamptz where id = \$2 and lot_id = \$3$/);
    expect(statement?.params).toEqual([at.toISOString(), entreeDemo.id, entreeDemo.lotId]);
  });

  it("writes the reading on the beacon with this minor in the gate's lot", async () => {
    const scripted = new ScriptedSql().answer('record-reported-battery', [{ id: 'aisle-a' }]);

    expect(await new PostgresEquipmentReports(scripted.database()).recordBeaconBattery(report)).toBe(true);
    const statement = scripted.statement('record-reported-battery');
    expect(statement?.text).toMatch(/set beacon_battery_percent = \$1, beacon_battery_reported_at = \$2::timestamptz\s+where lot_id = \$3 and beacon_minor = \$4\s+returning id/);
    expect(statement?.params).toEqual([15, at.toISOString(), entreeDemo.lotId, 1]);
  });

  it('answers false when no beacon of the lot has the minor', async () => {
    const scripted = new ScriptedSql().answer('record-reported-battery', []);

    expect(await new PostgresEquipmentReports(scripted.database()).recordBeaconBattery(report)).toBe(false);
  });
});
