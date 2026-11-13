import type { DashboardLotMap, LevelOrderRequest } from '@palier/shared-types';
import type { AisleDraft } from '@palier/shared-types/aisleDraft';
import { isMoveOfCurrentOrder } from '../../domain/dashboard/levelOrder.ts';
import type { LevelPlacement, LotMapRefusal, LotMapRepository, LotMapWrite } from '../../domain/dashboard/LotMapRepository.ts';
import type { Database, Transaction } from './database.ts';
import { isLotBusy, LOT_LOCK_TRANSACTION, orLotBusy } from './lockParkingLot.ts';
import { LIMIT_LOCK_WAIT } from './lockTimeout.ts';
import { lotMapOf, type LotMapRow } from './lotMapRows.ts';
import {
  insertAisleStatement,
  insertExitLaneStatement,
  insertLevelStatement,
  lockOwnedLotStatement,
  readLevelIdsStatement,
  readLotMapStatement,
  reorderLevelsStatement,
  type OwnedLot,
} from './lotMapStatements.ts';
import { AISLE_CODE_UNIQUE, AISLE_MINOR_UNIQUE, LEVEL_CODE_UNIQUE } from './lotSchema.ts';
import { violatedUniqueConstraintOf } from './uniqueViolation.ts';

type Executor = Pick<Transaction, 'execute'>;
type LockedWrite = (tx: Executor) => Promise<LotMapWrite>;

const TAKEN_BY_CONSTRAINT: ReadonlyMap<string, LotMapRefusal> = new Map([
  [LEVEL_CODE_UNIQUE, 'LEVEL_CODE_TAKEN'],
  [AISLE_CODE_UNIQUE, 'AISLE_CODE_TAKEN'],
  [AISLE_MINOR_UNIQUE, 'AISLE_MINOR_TAKEN'],
]);

export class PostgresLotMapRepository implements LotMapRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async readLotMap(operatorId: string, lotId: string): Promise<DashboardLotMap | null> {
    return lotMapOf(lotId, await this.#database.execute<LotMapRow>(readLotMapStatement({ operatorId, lotId })));
  }

  addLevel(operatorId: string, lotId: string, code: string): Promise<LotMapWrite> {
    return this.#writeInOwnedLot({ operatorId, lotId }, (tx) => addLevelWithExitLane(tx, { operatorId, lotId }, code));
  }

  reorderLevels(operatorId: string, lotId: string, order: LevelOrderRequest): Promise<LotMapWrite> {
    return this.#writeInOwnedLot({ operatorId, lotId }, (tx) => reorderEveryLevel(tx, { operatorId, lotId }, order));
  }

  addAisle(operatorId: string, placement: LevelPlacement, aisle: AisleDraft): Promise<LotMapWrite> {
    return this.#writeInOwnedLot({ operatorId, lotId: placement.lotId }, async (tx) => {
      const inserted = await tx.execute(insertAisleStatement(operatorId, placement, aisle));
      return inserted.length === 0 ? 'LEVEL_NOT_FOUND' : null;
    });
  }

  // Ownership is the first statement: another operator's lot is refused before any of its levels or aisles is read.
  async #writeInOwnedLot(lot: OwnedLot, write: LockedWrite): Promise<LotMapWrite> {
    try {
      const outcome = await orLotBusy(this.#database.transaction((tx) => lockedWrite(tx, lot, write), LOT_LOCK_TRANSACTION));
      return isLotBusy(outcome) ? 'LOT_BUSY' : outcome;
    } catch (error) {
      return takenRefusalOrThrow(error);
    }
  }
}

async function lockedWrite(tx: Executor, lot: OwnedLot, write: LockedWrite): Promise<LotMapWrite> {
  await tx.execute(LIMIT_LOCK_WAIT);
  const locked = await tx.execute(lockOwnedLotStatement(lot));
  return locked.length === 0 ? 'LOT_NOT_FOUND' : write(tx);
}

async function addLevelWithExitLane(tx: Executor, lot: OwnedLot, code: string): Promise<LotMapWrite> {
  const [inserted] = await tx.execute<{ readonly id: string }>(insertLevelStatement(lot, code));
  if (inserted === undefined) {
    return 'LEVEL_LIMIT_REACHED';
  }
  await tx.execute(insertExitLaneStatement(lot.operatorId, inserted.id));
  return null;
}

async function reorderEveryLevel(tx: Executor, lot: OwnedLot, order: LevelOrderRequest): Promise<LotMapWrite> {
  const current = await tx.execute<{ readonly id: string }>(readLevelIdsStatement(lot));
  if (!isMoveOfCurrentOrder(order, current.map(({ id }) => id))) {
    return 'LEVEL_ORDER_INVALID';
  }
  await tx.execute(reorderLevelsStatement(lot, order.levelIds));
  return null;
}

// A unique constraint refused the insert: the code or the minor is already taken in this lot or level.
function takenRefusalOrThrow(error: unknown): LotMapRefusal {
  const refusal = TAKEN_BY_CONSTRAINT.get(violatedUniqueConstraintOf(error) ?? '');
  if (refusal === undefined) {
    throw error;
  }
  return refusal;
}
