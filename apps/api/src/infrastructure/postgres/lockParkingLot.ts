import { sql } from 'drizzle-orm';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';
import type { Transaction } from './database.ts';

// Under REPEATABLE READ the statements after the lock wait would read a snapshot older than the previous holder's commit.
export const LOT_LOCK_TRANSACTION = { isolationLevel: 'read committed' } as const satisfies PgTransactionConfig;

export interface LockedParkingLot {
  readonly id: string;
  readonly name: string;
  readonly isOnline: boolean;
  readonly capacity: number;
  readonly vehicleCount: number;
}

interface LockedParkingLotRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly is_online: boolean;
  readonly capacity: number;
  readonly vehicle_count: number;
}

// Lot, then session, then spot: the order a loop closure, the cancellation job, an entry and a spot hold all take.
// The row is read under the lock, so a spot hold re-checks the lot as the previous holder left it; undefined for an unknown lot.
export async function lockParkingLot(tx: Pick<Transaction, 'execute'>, lotId: string): Promise<LockedParkingLot | undefined> {
  const rows = await tx.execute<LockedParkingLotRow>(sql`
    select id, name, is_online, capacity, vehicle_count from parking_lot where id = ${lotId} for no key update`);
  const row = rows[0];
  return row === undefined ? undefined : { id: row.id, name: row.name, isOnline: row.is_online, capacity: row.capacity, vehicleCount: row.vehicle_count };
}
