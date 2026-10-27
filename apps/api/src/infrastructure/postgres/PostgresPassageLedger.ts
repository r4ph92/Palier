import { sql } from 'drizzle-orm';
import type { PassageEntry, PassageLedger, RecordedPassage } from '../../domain/gates/PassageLedger.ts';
import type { Database } from './database.ts';

interface VehicleCountRow extends Record<string, unknown> {
  readonly vehicle_count: number;
}

export class PostgresPassageLedger implements PassageLedger {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async recordPassage(entry: PassageEntry): Promise<RecordedPassage> {
    const rows = await this.#database.execute<VehicleCountRow>(sql`
      with inserted as (
        insert into gate_passage (gate_id, lot_id, closed_at)
        values (${entry.gate.id}, ${entry.gate.lotId}, ${entry.closedAt.toISOString()})
        returning lot_id
      )
      update parking_lot
      set vehicle_count = greatest(parking_lot.vehicle_count + ${entry.vehicleCountChange}, 0)
      from inserted
      where parking_lot.id = inserted.lot_id
      returning parking_lot.vehicle_count`);
    return { vehicleCount: vehicleCountOf(rows) };
  }
}

function vehicleCountOf(rows: readonly VehicleCountRow[]): number {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('The passage did not update any parking lot.');
  }
  return row.vehicle_count;
}
