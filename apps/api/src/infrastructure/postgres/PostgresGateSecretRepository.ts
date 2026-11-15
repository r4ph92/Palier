import type { GateSecretRepository, QrSecretRead } from '../../domain/dashboard/GateSecretRepository.ts';
import { gateRefused, gateWritten, type GatePlace, type GateWrite } from '../../domain/dashboard/LotGateRepository.ts';
import { isUsableQrSecret } from '../../domain/entries/gateToken.ts';
import type { Database, Transaction } from './database.ts';
import {
  forgetGateControllerStatement,
  insertDeviceKeyStatement,
  readOwnedGateKindStatement,
  readOwnedGateQrSecretStatement,
  replaceQrSecretStatement,
  revokeDeviceKeysStatement,
  type OwnedGateKindRow,
  type OwnedGateQrSecretRow,
} from './lotGateStatements.ts';
import { writeInOwnedLot } from './ownedLotWrite.ts';

type Executor = Pick<Transaction, 'execute'>;

export class PostgresGateSecretRepository implements GateSecretRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  replaceDeviceKey(operatorId: string, gate: GatePlace, deviceKeyHash: string): Promise<GateWrite> {
    return this.#write(operatorId, gate, async (tx) => {
      if (!(await isGateOfLot(tx, gate))) {
        return gateRefused('GATE_NOT_FOUND');
      }
      await tx.execute(revokeDeviceKeysStatement(gate.gateId));
      await tx.execute(insertDeviceKeyStatement(gate.gateId, deviceKeyHash));
      await tx.execute(forgetGateControllerStatement(gate));
      return gateWritten(gate.gateId);
    });
  }

  replaceQrSecret(operatorId: string, gate: GatePlace, qrSecret: string): Promise<GateWrite> {
    return this.#write(operatorId, gate, async (tx) => {
      const replaced = await tx.execute(replaceQrSecretStatement(gate, qrSecret));
      return replaced.length === 0 ? gateRefused('GATE_NOT_FOUND') : gateWritten(gate.gateId);
    });
  }

  async usableQrSecret(operatorId: string, gate: GatePlace, spareSecret: string): Promise<QrSecretRead> {
    const outcome = await writeInOwnedLot(this.#database, { operatorId, lotId: gate.lotId }, (tx) => storedOrSpareSecret(tx, gate, spareSecret));
    return typeof outcome === 'string' ? { kind: 'refused', reason: outcome } : outcome;
  }

  async #write(operatorId: string, gate: GatePlace, write: (tx: Executor) => Promise<GateWrite>): Promise<GateWrite> {
    const outcome = await writeInOwnedLot(this.#database, { operatorId, lotId: gate.lotId }, write);
    return typeof outcome === 'string' ? gateRefused(outcome) : outcome;
  }
}

async function isGateOfLot(tx: Executor, gate: GatePlace): Promise<boolean> {
  const owned = await tx.execute<OwnedGateKindRow>(readOwnedGateKindStatement(gate));
  return owned.length > 0;
}

// A gate from before #67 may have no secret: it gets the spare one, and nothing else changes.
async function storedOrSpareSecret(tx: Executor, gate: GatePlace, spareSecret: string): Promise<QrSecretRead> {
  const [owned] = await tx.execute<OwnedGateQrSecretRow>(readOwnedGateQrSecretStatement(gate));
  if (owned === undefined) {
    return { kind: 'refused', reason: 'GATE_NOT_FOUND' };
  }
  if (isUsableQrSecret(owned.qr_secret)) {
    return { kind: 'secret', qrSecret: owned.qr_secret };
  }
  await tx.execute(replaceQrSecretStatement(gate, spareSecret));
  return { kind: 'secret', qrSecret: spareSecret };
}
