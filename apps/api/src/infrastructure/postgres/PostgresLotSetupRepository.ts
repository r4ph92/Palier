import { sql, type SQL } from 'drizzle-orm';
import type { DashboardLotDetails } from '@palier/shared-types';
import type { LotDraft } from '@palier/shared-types/lotDraft';
import type { LotPricing } from '@palier/shared-types/lotPricing';
import type { LotSetupRepository } from '../../domain/dashboard/LotSetupRepository.ts';
import { storedPricingPolicyOf } from '../../domain/pricing/PricingPolicy.ts';
import type { Database } from './database.ts';
import { lotDetailsOf, type LotDetailsRow } from './lotDetailsRow.ts';

const LOT_DETAILS_COLUMNS = sql.raw('id, name, is_online, address, latitude, longitude, capacity, beacon_major, pricing_policy, daily_cap_cents, hold_quota');

export class PostgresLotSetupRepository implements LotSetupRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  // The beacon major comes from the column's sequence; online, pricing and counts keep their defaults.
  async createLot(operatorId: string, { name, address, latitude, longitude, capacity }: LotDraft): Promise<DashboardLotDetails> {
    const created = await this.#detailsOf(sql`
      insert into parking_lot (operator_id, name, address, latitude, longitude, capacity, is_online)
      values (${operatorId}, ${name}, ${address}, ${latitude}, ${longitude}, ${capacity}, false)
      returning ${LOT_DETAILS_COLUMNS}`);
    if (created === null) {
      throw new Error('Inserting the lot returned no row.');
    }
    return created;
  }

  // Open sessions keep the pricing copied at their entry (decision 011): only parking_lot changes.
  updateLotPricing(operatorId: string, lotId: string, pricing: LotPricing): Promise<DashboardLotDetails | null> {
    return this.#detailsOf(sql`
      update parking_lot
      set pricing_policy = ${JSON.stringify(storedPricingPolicyOf(pricing))}::jsonb, daily_cap_cents = ${pricing.dailyCapCents}, hold_quota = ${pricing.holdQuota}
      where id = ${lotId} and operator_id = ${operatorId}
      returning ${LOT_DETAILS_COLUMNS}`);
  }

  findLotDetailsOfOperator(operatorId: string, lotId: string): Promise<DashboardLotDetails | null> {
    return this.#detailsOf(sql`select ${LOT_DETAILS_COLUMNS} from parking_lot where id = ${lotId} and operator_id = ${operatorId}`);
  }

  async #detailsOf(statement: SQL): Promise<DashboardLotDetails | null> {
    const [row] = await this.#database.execute<LotDetailsRow>(statement);
    return row === undefined ? null : lotDetailsOf(row);
  }
}
