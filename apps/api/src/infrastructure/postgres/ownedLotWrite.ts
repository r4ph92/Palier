import type { Database, Transaction } from './database.ts';
import { inOwnedLotLock, isLotBusy, isLotNotOwned, orLotBusy, type OwnedLot } from './lockParkingLot.ts';

export type OwnedLotRefusal = 'LOT_NOT_FOUND' | 'LOT_BUSY';

// A dashboard write: ownership is the first statement, so another operator's lot is refused before any of its rows is read.
export async function writeInOwnedLot<T>(database: Database, lot: OwnedLot, write: (tx: Transaction) => Promise<T>): Promise<T | OwnedLotRefusal> {
  const outcome = await orLotBusy(inOwnedLotLock(database, lot, write));
  if (isLotBusy(outcome)) {
    return 'LOT_BUSY';
  }
  return isLotNotOwned(outcome) ? 'LOT_NOT_FOUND' : outcome;
}
