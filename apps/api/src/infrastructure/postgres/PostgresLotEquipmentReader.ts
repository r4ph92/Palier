import type { GateKind } from '@palier/shared-types';
import type { LotEquipmentReader, LotGates, StoredGate } from '../../domain/dashboard/LotEquipmentReader.ts';
import type { Database } from './database.ts';
import { readLotGatesStatement } from './equipmentStatements.ts';

interface LotGateRow extends Record<string, unknown> {
  readonly lot_name: string;
  readonly gate_id: string | null;
  readonly gate_name: string | null;
  readonly gate_kind: GateKind | null;
  readonly last_heartbeat_at: Date | string | null;
}

type GateRow = LotGateRow & { readonly gate_id: string; readonly gate_name: string; readonly gate_kind: GateKind };

export class PostgresLotEquipmentReader implements LotEquipmentReader {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async readLotGates(operatorId: string, lotId: string): Promise<LotGates | null> {
    return lotGatesOf(await this.#database.execute<LotGateRow>(readLotGatesStatement(operatorId, lotId)));
  }
}

function lotGatesOf(rows: readonly LotGateRow[]): LotGates | null {
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  return { lotName: first.lot_name, gates: rows.filter(isGateRow).map(storedGateOf) };
}

function isGateRow(row: LotGateRow): row is GateRow {
  return row.gate_id !== null;
}

function storedGateOf(row: GateRow): StoredGate {
  const lastHeartbeatAt = row.last_heartbeat_at === null ? null : new Date(row.last_heartbeat_at);
  return { id: row.gate_id, name: row.gate_name, kind: row.gate_kind, lastHeartbeatAt };
}
