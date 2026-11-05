import { sql } from 'drizzle-orm';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';
import type { Transaction } from './database.ts';

// Under REPEATABLE READ the statements after the lock wait would read a snapshot older than the previous holder's commit.
export const LOT_LOCK_TRANSACTION = { isolationLevel: 'read committed' } as const satisfies PgTransactionConfig;

export interface LockedParkingLot extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly is_online: boolean;
  readonly capacity: number;
  readonly vehicle_count: number;
}

// Lot, then session, then spot: the order a loop closure, the cancellation job, an entry and a spot hold all take.
// The row is read under the lock, so a spot hold re-checks the lot as the previous holder left it; undefined for an unknown lot.
export async function lockParkingLot(tx: Pick<Transaction, 'execute'>, lotId: string): Promise<LockedParkingLot | undefined> {
  const rows = await tx.execute<LockedParkingLot>(sql`
    select id, name, is_online, capacity, vehicle_count from parking_lot where id = ${lotId} for no key update`);
  return rows[0];
}
