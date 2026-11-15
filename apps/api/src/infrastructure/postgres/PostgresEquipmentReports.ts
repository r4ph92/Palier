import type { BeaconBatteryReport, EquipmentReports, ReportingGate, TestPassage } from '../../domain/equipment/EquipmentReports.ts';
import type { Database } from './database.ts';
import { recordHeartbeatStatement, recordReportedBatteryStatement, recordTestPassageStatement } from './equipmentStatements.ts';

// One statement each, without the lot lock: no write touches a spot, a session or the vehicle counter.
export class PostgresEquipmentReports implements EquipmentReports {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async recordHeartbeat(gate: ReportingGate, at: Date): Promise<void> {
    await this.#database.execute(recordHeartbeatStatement(gate, at));
  }

  async recordBeaconBattery(report: BeaconBatteryReport): Promise<boolean> {
    const updated = await this.#database.execute(recordReportedBatteryStatement(report));
    return updated.length > 0;
  }

  async recordTestPassage(gate: ReportingGate, passage: TestPassage): Promise<boolean> {
    const updated = await this.#database.execute(recordTestPassageStatement(gate, passage));
    return updated.length > 0;
  }
}
