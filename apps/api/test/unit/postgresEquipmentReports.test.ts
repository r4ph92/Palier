import { describe, expect, it } from 'vitest';
import { PostgresEquipmentReports } from '../../src/infrastructure/postgres/PostgresEquipmentReports.ts';
import { PostgresLotEquipmentReader } from '../../src/infrastructure/postgres/PostgresLotEquipmentReader.ts';
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

describe('reading the gates of a lot from Postgres', () => {
  const lotRow = { lot_name: 'Parking Démo' };

  it("reads only the operator's lot, entry gates first, without the QR secret or the endpoint", async () => {
    const scripted = new ScriptedSql().answer('read-lot-gates', [
      { ...lotRow, gate_id: 'entree', gate_name: 'Entrée Démo', gate_kind: 'ENTRY', last_heartbeat_at: '2026-11-13 19:05:00+00' },
      { ...lotRow, gate_id: 'sortie', gate_name: 'Sortie Démo', gate_kind: 'EXIT', last_heartbeat_at: null },
    ]);

    const gates = await new PostgresLotEquipmentReader(scripted.database()).readLotGates('operator-lavoie', entreeDemo.lotId);

    expect(gates).toEqual({
      lotName: 'Parking Démo',
      gates: [
        { id: 'entree', name: 'Entrée Démo', kind: 'ENTRY', lastHeartbeatAt: at },
        { id: 'sortie', name: 'Sortie Démo', kind: 'EXIT', lastHeartbeatAt: null },
      ],
    });
    const statement = scripted.statement('read-lot-gates');
    expect(statement?.text).toMatch(/where parking_lot\.id = \$1 and parking_lot\.operator_id = \$2\s+order by gate\.kind, gate\.name$/);
    expect(statement?.text).not.toMatch(/qr_secret|endpoint/);
    expect(statement?.params).toEqual([entreeDemo.lotId, 'operator-lavoie']);
  });

  it('reads a lot without gates as an empty list, and another operator\'s lot as absent', async () => {
    const withoutGates = new ScriptedSql().answer('read-lot-gates', [{ ...lotRow, gate_id: null, gate_name: null, gate_kind: null, last_heartbeat_at: null }]);
    const notOwned = new ScriptedSql().answer('read-lot-gates', []);

    expect(await new PostgresLotEquipmentReader(withoutGates.database()).readLotGates('operator-lavoie', entreeDemo.lotId)).toEqual({ lotName: 'Parking Démo', gates: [] });
    expect(await new PostgresLotEquipmentReader(notOwned.database()).readLotGates('operator-roy', entreeDemo.lotId)).toBeNull();
  });
});
