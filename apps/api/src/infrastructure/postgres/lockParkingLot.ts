import { sql } from 'drizzle-orm';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';
import type { Transaction } from './database.ts';

// Under REPEATABLE READ the statements after the lock wait would read a snapshot older than the previous holder's commit.
export const LOT_LOCK_TRANSACTION = { isolationLevel: 'read committed' } as const satisfies PgTransactionConfig;

// Lot, then session, then spot: the order a loop closure, the cancellation job and an entry all take.
export async function lockParkingLot(tx: Transaction, lotId: string): Promise<void> {
  await tx.execute(sql`select id from parking_lot where id = ${lotId} for no key update`);
}
