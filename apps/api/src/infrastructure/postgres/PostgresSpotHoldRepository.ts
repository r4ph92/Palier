import { sql } from 'drizzle-orm';
import { decideSpotHoldRequest } from '../../domain/spotHolds/decideSpotHoldRequest.ts';
import type { SpotHold } from '../../domain/spotHolds/SpotHold.ts';
import { SpotHoldRefusedError } from '../../domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldDraft, SpotHoldLot, SpotHoldRepository } from '../../domain/spotHolds/SpotHoldRepository.ts';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import type { Database, Transaction } from './database.ts';
import { LOT_LOCK_TRANSACTION, lockParkingLot, type LockedParkingLot } from './lockParkingLot.ts';
import { LIMIT_LOCK_WAIT } from './lockTimeout.ts';
import { claimFirstFittingSpot, heldSince } from './spotClaim.ts';
import { readSpotHoldFacts } from './spotHoldFacts.ts';
import { spotHoldRefusalOf } from './spotHoldRefusal.ts';

interface ActiveSpotHoldRow extends Record<string, unknown> {
  readonly id: string;
  readonly lot_id: string;
  readonly lot_name: string;
  readonly expires_at: Date | string;
}

interface SpotHoldLotRow extends Record<string, unknown> {
  readonly id: string;
  readonly is_online: boolean;
  readonly pricing_policy: unknown;
  readonly daily_cap_cents: number;
  readonly stripe_account_id: string | null;
}

export class PostgresSpotHoldRepository implements SpotHoldRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findActiveSpotHold(driverId: string): Promise<SpotHold | null> {
    const rows = await this.#database.execute<ActiveSpotHoldRow>(sql`
      select h.id, h.lot_id, lot.name as lot_name, h.expires_at
      from (select id, lot_id, expires_at from spot_hold where user_id = ${driverId} and ${ACTIVE_SPOT_HOLD}) h
      join parking_lot lot on lot.id = h.lot_id`);
    const row = rows[0];
    return row === undefined ? null : { id: row.id, lotId: row.lot_id, lotName: row.lot_name, expiresAt: new Date(row.expires_at) };
  }

  async findSpotHoldLot(lotId: string): Promise<SpotHoldLot | null> {
    const rows = await this.#database.execute<SpotHoldLotRow>(sql`
      select lot.id, lot.is_online, lot.pricing_policy, lot.daily_cap_cents, operator.stripe_account_id
      from parking_lot lot join operator on operator.id = lot.operator_id
      where lot.id = ${lotId}`);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { id: row.id, isOnline: row.is_online, pricingPolicy: row.pricing_policy, dailyCapCents: row.daily_cap_cents, operatorStripeAccountId: row.stripe_account_id };
  }

  async placeSpotHold(draft: SpotHoldDraft): Promise<SpotHold> {
    try {
      return await this.#database.transaction(async (tx) => {
        await tx.execute(LIMIT_LOCK_WAIT);
        return await placeUnderLotLock(tx, draft);
      }, LOT_LOCK_TRANSACTION);
    } catch (error) {
      throw spotHoldRefusalOf(error, draft.lotId);
    }
  }
}

async function placeUnderLotLock(tx: Transaction, draft: SpotHoldDraft): Promise<SpotHold> {
  const lot = await lockParkingLot(tx, draft.lotId);
  if (lot === undefined) {
    throw new SpotHoldRefusedError('LOT_NOT_FOUND');
  }
  const decision = decideSpotHoldRequest(await readSpotHoldFacts(tx, lot, draft.driverId));
  if (decision.kind === 'refuse') {
    throw new SpotHoldRefusedError(decision.reason);
  }
  const spot = await claimFirstFittingSpot(tx, { lotId: lot.id, needs: draft.needs, target: heldSince(draft.createdAt) });
  if (spot === undefined) {
    throw new SpotHoldRefusedError('NO_SUITABLE_SPOT');
  }
  return insertSpotHold(tx, draft, { spotId: spot.id, lot });
}

interface HeldSpot {
  readonly spotId: string;
  readonly lot: LockedParkingLot;
}

async function insertSpotHold(tx: Transaction, draft: SpotHoldDraft, { spotId, lot }: HeldSpot): Promise<SpotHold> {
  const rows = await tx.execute<{ id: string }>(sql`
    insert into spot_hold (user_id, lot_id, spot_id, created_at, expires_at)
    values (${draft.driverId}, ${lot.id}, ${spotId}, ${draft.createdAt.toISOString()}::timestamptz, ${draft.expiresAt.toISOString()}::timestamptz)
    returning id`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error('The spot hold was not created.');
  }
  return { id: row.id, lotId: lot.id, lotName: lot.name, expiresAt: draft.expiresAt };
}
