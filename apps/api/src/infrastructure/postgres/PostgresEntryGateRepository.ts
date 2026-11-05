import { eq } from 'drizzle-orm';
import type { EntryGate, EntryGateRepository } from '../../domain/entries/EntryGateRepository.ts';
import type { Database } from './database.ts';
import { HELD_SPOT_COUNT } from './heldSpotCount.ts';
import { gate, operator, parkingLot } from './schema.ts';

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
}
