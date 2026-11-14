import type { DashboardAisleSpots } from '@palier/shared-types';
import { MAX_SPOTS_PER_LOT, type SpotAttributes } from '@palier/shared-types/spotDraft';
import type { AislePlace, LotSpotRepository, LotSpotWrite, SpotBatch, SpotPlace } from '../../domain/dashboard/LotSpotRepository.ts';
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
    return writeInOwnedLot(this.#database, { operatorId, lotId: aisle.lotId }, (tx) => insertSpots(tx, { operatorId, aisle, batch }));
  }

  changeSpot(operatorId: string, spot: SpotPlace, attributes: SpotAttributes): Promise<LotSpotWrite> {
    return writeInOwnedLot(this.#database, { operatorId, lotId: spot.lotId }, async (tx) => {
      const [changed] = await tx.execute<AisleIdRow>(changeSpotStatement(operatorId, spot, attributes));
      return changed === undefined ? 'SPOT_NOT_FOUND' : { aisleId: changed.aisle_id };
    });
  }

  retireSpot(operatorId: string, spot: SpotPlace): Promise<LotSpotWrite> {
    return writeInOwnedLot(this.#database, { operatorId, lotId: spot.lotId }, (tx) => retireUnusedSpot(tx, operatorId, spot));
  }
}

// The aisle, then the lot's spot limit, then the numbers already taken: the first refusal wins and nothing is inserted.
async function insertSpots(tx: Executor, { operatorId, aisle, batch }: SpotInsert): Promise<LotSpotWrite> {
  const parkingAisles = await tx.execute(readParkingAisleStatement(operatorId, aisle));
  if (parkingAisles.length === 0) {
    return 'AISLE_NOT_FOUND';
  }
  const [counted] = await tx.execute<{ readonly spot_count: number }>(countLiveSpotsStatement(operatorId, aisle.lotId));
  if ((counted?.spot_count ?? 0) + batch.numbers.length > MAX_SPOTS_PER_LOT) {
    return 'SPOT_LIMIT_REACHED';
  }
  const [taken] = await tx.execute<{ readonly number: string }>(firstTakenNumberStatement(operatorId, aisle.lotId, batch.numbers));
  if (taken !== undefined) {
    return { takenNumber: taken.number };
  }
  await tx.execute(insertSpotsStatement(operatorId, aisle, batch));
  return { aisleId: aisle.aisleId };
}

// A spot nothing ever pointed at is deleted; one with history is retired, so its sessions, holds and reports keep their spot.
// Neither matched: the spot is in use when it is still live, otherwise it does not exist for this operator.
async function retireUnusedSpot(tx: Executor, operatorId: string, spot: SpotPlace): Promise<LotSpotWrite> {
  const [deleted] = await tx.execute<AisleIdRow>(deleteSpotWithoutHistoryStatement(operatorId, spot));
  const [retired] = deleted === undefined ? await tx.execute<AisleIdRow>(retireSpotStatement(operatorId, spot)) : [deleted];
  if (retired !== undefined) {
    return { aisleId: retired.aisle_id };
  }
  const live = await tx.execute(readLiveSpotStatement(operatorId, spot));
  return live.length === 0 ? 'SPOT_NOT_FOUND' : 'SPOT_IN_USE';
}
