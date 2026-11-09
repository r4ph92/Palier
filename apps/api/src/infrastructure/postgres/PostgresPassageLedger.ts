import { sql } from 'drizzle-orm';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import type { PassageEntry, PassageLedger, RecordedPassage } from '../../domain/gates/PassageLedger.ts';
import type { Database, Transaction } from './database.ts';
import { LOT_LOCK_TRANSACTION } from './lockParkingLot.ts';
import { isWithinOpeningWindow } from './openingWindowSql.ts';

interface VehicleCountRow extends Record<string, unknown> {
  readonly vehicle_count: number;
}

interface ConfirmedSessionRow extends Record<string, unknown> {
  readonly id: string;
  readonly assigned_spot_id: string;
}

export class PostgresPassageLedger implements PassageLedger {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  recordPassage(entry: PassageEntry): Promise<RecordedPassage> {
    return this.#database.transaction(async (tx) => {
      const vehicleCount = await countVehicle(tx, entry);
      return { vehicleCount, confirmedSessionId: await confirmOpening(tx, entry), exitedSessionId: await attachExitPassage(tx, entry) };
    }, LOT_LOCK_TRANSACTION);
  }
}

async function countVehicle(tx: Transaction, entry: PassageEntry): Promise<number> {
  const rows = await tx.execute<VehicleCountRow>(sql`
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
  const row = rows[0];
  if (row === undefined) {
    throw new Error('The passage did not update any parking lot.');
  }
  return row.vehicle_count;
}

async function confirmOpening(tx: Transaction, entry: PassageEntry): Promise<string | null> {
  if (entry.confirmableOpenings === null) {
    return null;
  }
  const confirmed = await confirmOldestOpening(tx, entry, entry.confirmableOpenings);
  if (confirmed === undefined) {
    return null;
  }
  await occupySpot(tx, confirmed.assigned_spot_id);
  return confirmed.id;
}

// The oldest opening wins; the parking_lot row lock taken by countVehicle serialises closures per lot, so it must run first.
async function confirmOldestOpening(tx: Transaction, entry: PassageEntry, window: OpeningWindow): Promise<ConfirmedSessionRow | undefined> {
  const rows = await tx.execute<ConfirmedSessionRow>(sql`
    update parking_session
    set state = 'ENTRY_CONFIRMED', entry_confirmed_at = ${entry.closedAt.toISOString()}
    where id = (
      select s.id
      from gate_command c
      join parking_session s on s.id = c.session_id
      where c.gate_id = ${entry.gate.id} and c.kind = 'OPEN' and s.state = 'CREATED'
        and ${isWithinOpeningWindow(sql`c.issued_at`, window)}
      order by c.issued_at, c.id
      limit 1
      for update of s
    ) and state = 'CREATED'
    returning id, assigned_spot_id`);
  return rows[0];
}

// The oldest exit opening whose session is still unattached wins; like confirmOpening it runs after countVehicle took the lot lock.
async function attachExitPassage(tx: Transaction, entry: PassageEntry): Promise<string | null> {
  if (entry.attachableOpenings === null) {
    return null;
  }
  const rows = await tx.execute<{ readonly id: string }>(sql`
    update parking_session
    set exit_passage_at = ${entry.closedAt.toISOString()}
    where id = (
      select s.id
      from gate_command c
      join parking_session s on s.id = c.session_id
      where c.gate_id = ${entry.gate.id} and c.kind = 'OPEN' and s.state = 'CLOSED_PAID' and s.exit_passage_at is null
        and ${isWithinOpeningWindow(sql`c.issued_at`, entry.attachableOpenings)}
      order by c.issued_at, c.id
      limit 1
      for update of s
    ) and exit_passage_at is null
    returning id`);
  return rows[0]?.id ?? null;
}

async function occupySpot(tx: Transaction, spotId: string): Promise<void> {
  await tx.execute(sql`
    update spot set state = 'OCCUPIED', state_changed_at = now()
    where id = ${spotId} and state = 'ASSIGNED'`);
}
