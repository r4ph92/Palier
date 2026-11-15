import type { DashboardLotGates } from '@palier/shared-types';
import { exitIdentificationErrorOf, MAX_GATES_PER_LOT, type GateSettings } from '@palier/shared-types/gateDraft';
import { gateRefused, gateWritten, type GatePlace, type GateWrite, type LotGateRepository, type NewGate } from '../../domain/dashboard/LotGateRepository.ts';
import type { Database, Transaction } from './database.ts';
import { lotGatesOf, type GateSettingsRow } from './lotGateRows.ts';
import {
  changeGateStatement,
  countLotGatesStatement,
  GATE_NAME_UNIQUE,
  insertDeviceKeyStatement,
  insertGateStatement,
  readGateSettingsStatement,
  readOwnedGateStatement,
  type OwnedGateRow,
} from './lotGateStatements.ts';
import { writeInOwnedLot } from './ownedLotWrite.ts';
import { violatedUniqueConstraintOf } from './uniqueViolation.ts';

type Executor = Pick<Transaction, 'execute'>;

interface GateCountRow extends Record<string, unknown> {
  readonly gate_count: number;
  readonly exit_gate_count: number;
}

export class PostgresLotGateRepository implements LotGateRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async readLotGates(operatorId: string, lotId: string): Promise<DashboardLotGates | null> {
    return lotGatesOf(lotId, await this.#database.execute<GateSettingsRow>(readGateSettingsStatement(operatorId, lotId)));
  }

  addGate(operatorId: string, lotId: string, gate: NewGate): Promise<GateWrite> {
    return this.#write(operatorId, lotId, (tx) => insertGate(tx, lotId, gate));
  }

  changeGate(operatorId: string, gate: GatePlace, settings: GateSettings): Promise<GateWrite> {
    return this.#write(operatorId, gate.lotId, (tx) => changeOwnedGate(tx, gate, settings));
  }

  // The unique name rolls the transaction back: the refusal is answered once nothing was saved.
  async #write(operatorId: string, lotId: string, write: (tx: Executor) => Promise<GateWrite>): Promise<GateWrite> {
    try {
      const outcome = await writeInOwnedLot(this.#database, { operatorId, lotId }, write);
      return typeof outcome === 'string' ? gateRefused(outcome) : outcome;
    } catch (error) {
      if (violatedUniqueConstraintOf(error) === GATE_NAME_UNIQUE) {
        return gateRefused('GATE_NAME_TAKEN');
      }
      throw error;
    }
  }
}

// The lot's limits first, then the gate and its first device key.
async function insertGate(tx: Executor, lotId: string, gate: NewGate): Promise<GateWrite> {
  const limit = await gateLimitRefusalOf(tx, lotId, gate);
  if (limit !== null) {
    return limit;
  }
  const [inserted] = await tx.execute<{ readonly id: string }>(insertGateStatement(lotId, gate));
  if (inserted === undefined) {
    throw new Error('The gate was not stored.');
  }
  await tx.execute(insertDeviceKeyStatement(inserted.id, gate.deviceKeyHash));
  return gateWritten(inserted.id);
}

// The app's exit opens the lot's first exit gate by name, so a second one would never open (decision 038).
async function gateLimitRefusalOf(tx: Executor, lotId: string, { draft }: NewGate): Promise<GateWrite | null> {
  const [counted] = await tx.execute<GateCountRow>(countLotGatesStatement(lotId));
  if ((counted?.gate_count ?? 0) >= MAX_GATES_PER_LOT) {
    return gateRefused('GATE_LIMIT_REACHED');
  }
  if (draft.kind === 'EXIT' && (counted?.exit_gate_count ?? 0) > 0) {
    return gateRefused('GATE_EXIT_LIMIT');
  }
  return null;
}

async function changeOwnedGate(tx: Executor, gate: GatePlace, settings: GateSettings): Promise<GateWrite> {
  const [owned] = await tx.execute<OwnedGateRow>(readOwnedGateStatement(gate));
  if (owned === undefined) {
    return gateRefused('GATE_NOT_FOUND');
  }
  const refusal = exitIdentificationErrorOf(owned.kind, settings.exitIdentification);
  if (refusal !== null) {
    return gateRefused(refusal);
  }
  await tx.execute(changeGateStatement(gate, settings));
  return gateWritten(gate.gateId);
}
