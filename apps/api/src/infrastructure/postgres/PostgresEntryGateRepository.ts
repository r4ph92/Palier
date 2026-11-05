import { eq, sql } from 'drizzle-orm';
import type { EntryGate, EntryGateRepository, HoldQuery } from '../../domain/entries/EntryGateRepository.ts';
import type { Database } from './database.ts';
import { HELD_SPOT_COUNT } from './heldSpotCount.ts';
import { gate, operator, parkingLot } from './schema.ts';
import { usableSpotHold } from './spotHoldUse.ts';

const entryGateColumns = {
  id: gate.id,
  kind: gate.kind,
  integrationKind: gate.integrationKind,
  qrSecret: gate.qrSecret,
  lot: {
    id: parkingLot.id,
    isOnline: parkingLot.isOnline,
    dailyCapCents: parkingLot.dailyCapCents,
    pricingPolicy: parkingLot.pricingPolicy,
    capacity: parkingLot.capacity,
    vehicleCount: parkingLot.vehicleCount,
    heldSpotCount: HELD_SPOT_COUNT,
    operatorStripeAccountId: operator.stripeAccountId,
  },
};

export class PostgresEntryGateRepository implements EntryGateRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findGate(gateId: string): Promise<EntryGate | null> {
    const [found] = await this.#database
      .select(entryGateColumns)
      .from(gate)
      .innerJoin(parkingLot, eq(parkingLot.id, gate.lotId))
      .innerJoin(operator, eq(operator.id, parkingLot.operatorId))
      .where(eq(gate.id, gateId))
      .limit(1);
    return found ?? null;
  }

  async holdsRoomIn(query: HoldQuery): Promise<boolean> {
    const rows = await this.#database.execute(sql`select 1 from spot_hold where ${usableSpotHold(query)} limit 1`);
    return rows.length > 0;
  }
}
