import { sql } from 'drizzle-orm';
import type { Transaction } from './database.ts';

// Lot, then session, then spot: the order a loop closure, the cancellation job and an entry all take.
// Relies on READ COMMITTED: each later statement sees what the previous holder committed, where REPEATABLE READ would read a snapshot older than the wait.
export async function lockParkingLot(tx: Transaction, lotId: string): Promise<void> {
  await tx.execute(sql`select id from parking_lot where id = ${lotId} for no key update`);
}
