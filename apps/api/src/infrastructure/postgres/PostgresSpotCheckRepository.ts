import type { DashboardSpotsToCheck } from '@palier/shared-types';
import type { SpotPlace } from '../../domain/dashboard/LotSpotRepository.ts';
import type { SpotCheckRefusal, SpotCheckRepository } from '../../domain/dashboard/SpotCheckRepository.ts';
import type { Database, Transaction } from './database.ts';
import { requireUpdatedRow } from './requireUpdatedRow.ts';
import { writeInOwnedLot } from './ownedLotWrite.ts';
import { clearSpotCheckStatement, lockSpotToClearStatement, readSpotsToCheckStatement } from './spotCheckStatements.ts';
import { spotsToCheckOf, type SpotToCheckRow } from './spotCheckRows.ts';
import { clearDecisionOf } from '../../domain/dashboard/clearDecisionOf.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';

interface SpotToClearRow extends Record<string, unknown> {
  readonly state: SpotState;
  readonly needs_check: boolean;
  readonly held_by_session: boolean;
}

export class PostgresSpotCheckRepository implements SpotCheckRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listSpotsToCheck(operatorId: string, lotId: string): Promise<DashboardSpotsToCheck | null> {
    const rows = await this.#database.execute<SpotToCheckRow>(readSpotsToCheckStatement(operatorId, lotId));
    return rows.length === 0 ? null : spotsToCheckOf(rows);
  }

  clearSpotCheck(operatorId: string, spot: SpotPlace): Promise<'CLEARED' | SpotCheckRefusal> {
    return writeInOwnedLot(this.#database, { operatorId, lotId: spot.lotId }, (tx) => clearUnheldSpot(tx, operatorId, spot));
  }
}

async function clearUnheldSpot(tx: Pick<Transaction, 'execute'>, operatorId: string, spot: SpotPlace): Promise<'CLEARED' | SpotCheckRefusal> {
  const [row] = await tx.execute<SpotToClearRow>(lockSpotToClearStatement(operatorId, spot));
  if (row === undefined) {
    return 'SPOT_NOT_FOUND';
  }
  const decision = clearDecisionOf({ state: row.state, needsCheck: row.needs_check, heldBySession: row.held_by_session });
  if (decision === 'STILL_ASSIGNED') {
    return 'SPOT_STILL_ASSIGNED';
  }
  if (decision === 'CLEAR') {
    requireUpdatedRow(await tx.execute(clearSpotCheckStatement(operatorId, spot)), `Spot ${spot.spotId} could not be cleared under its lock.`);
  }
  return 'CLEARED';
}
