import type { DashboardAisleSpots } from '@palier/shared-types';
import { MAX_SPOTS_PER_LOT, type SpotAttributes } from '@palier/shared-types/spotDraft';
import { spotNumberTaken, spotsRefused, spotsWritten, type AislePlace, type LotSpotRepository, type LotSpotWrite, type SpotBatch, type SpotPlace } from '../../domain/dashboard/LotSpotRepository.ts';
import type { Database, Transaction } from './database.ts';
import { aisleSpotsOf, type AisleSpotRow } from './lotSpotRows.ts';
import {
  changeSpotStatement,
  countLiveSpotsStatement,
  deleteSpotWithoutHistoryStatement,
  firstTakenNumberStatement,
  insertSpotsStatement,
  readAisleSpotsStatement,
  readLiveSpotStatement,
  readParkingAisleStatement,
  retireSpotStatement,
} from './lotSpotStatements.ts';
import type { OwnedLot } from './lockParkingLot.ts';
import { writeInOwnedLot } from './ownedLotWrite.ts';

type Executor = Pick<Transaction, 'execute'>;

interface AisleIdRow extends Record<string, unknown> {
  readonly aisle_id: string;
}

interface SpotInsert {
  readonly operatorId: string;
  readonly aisle: AislePlace;
  readonly batch: SpotBatch;
}

export class PostgresLotSpotRepository implements LotSpotRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async readAisleSpots(operatorId: string, aisle: AislePlace): Promise<DashboardAisleSpots | null> {
    return aisleSpotsOf(await this.#database.execute<AisleSpotRow>(readAisleSpotsStatement(operatorId, aisle)));
  }

  addSpots(operatorId: string, aisle: AislePlace, batch: SpotBatch): Promise<LotSpotWrite> {
    return this.#write({ operatorId, lotId: aisle.lotId }, (tx) => insertSpots(tx, { operatorId, aisle, batch }));
  }

  changeSpot(operatorId: string, spot: SpotPlace, attributes: SpotAttributes): Promise<LotSpotWrite> {
    return this.#write({ operatorId, lotId: spot.lotId }, async (tx) => {
      const [changed] = await tx.execute<AisleIdRow>(changeSpotStatement(operatorId, spot, attributes));
      return changed === undefined ? spotsRefused('SPOT_NOT_FOUND') : spotsWritten(changed.aisle_id);
    });
  }

  removeSpot(operatorId: string, spot: SpotPlace): Promise<LotSpotWrite> {
    return this.#write({ operatorId, lotId: spot.lotId }, (tx) => removeUnusedSpot(tx, operatorId, spot));
  }

  async #write(lot: OwnedLot, write: (tx: Executor) => Promise<LotSpotWrite>): Promise<LotSpotWrite> {
    const outcome = await writeInOwnedLot(this.#database, lot, write);
    return typeof outcome === 'string' ? spotsRefused(outcome) : outcome;
  }
}

// The aisle, then the lot's spot limit, then the numbers already taken: the first refusal wins and nothing is inserted.
async function insertSpots(tx: Executor, { operatorId, aisle, batch }: SpotInsert): Promise<LotSpotWrite> {
  const parkingAisles = await tx.execute(readParkingAisleStatement(operatorId, aisle));
  if (parkingAisles.length === 0) {
    return spotsRefused('AISLE_NOT_FOUND');
  }
  const [counted] = await tx.execute<{ readonly spot_count: number }>(countLiveSpotsStatement(operatorId, aisle.lotId));
  if ((counted?.spot_count ?? 0) + batch.numbers.length > MAX_SPOTS_PER_LOT) {
    return spotsRefused('SPOT_LIMIT_REACHED');
  }
  const [taken] = await tx.execute<{ readonly number: string }>(firstTakenNumberStatement(operatorId, aisle.lotId, batch.numbers));
  if (taken !== undefined) {
    return spotNumberTaken(taken.number);
  }
  await tx.execute(insertSpotsStatement(operatorId, aisle, batch));
  return spotsWritten(aisle.aisleId);
}

// A spot nothing ever pointed at is deleted; one with history is retired, so its sessions, holds and reports keep their spot.
async function removeUnusedSpot(tx: Executor, operatorId: string, spot: SpotPlace): Promise<LotSpotWrite> {
  const [deleted] = await tx.execute<AisleIdRow>(deleteSpotWithoutHistoryStatement(operatorId, spot));
  if (deleted !== undefined) {
    return spotsWritten(deleted.aisle_id);
  }
  const [retired] = await tx.execute<AisleIdRow>(retireSpotStatement(operatorId, spot));
  if (retired !== undefined) {
    return spotsWritten(retired.aisle_id);
  }
  return spotsRefused(await spotInUseOrNotFound(tx, operatorId, spot));
}

async function spotInUseOrNotFound(tx: Executor, operatorId: string, spot: SpotPlace): Promise<'SPOT_IN_USE' | 'SPOT_NOT_FOUND'> {
  const live = await tx.execute(readLiveSpotStatement(operatorId, spot));
  return live.length === 0 ? 'SPOT_NOT_FOUND' : 'SPOT_IN_USE';
}
