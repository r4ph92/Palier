import { sql } from 'drizzle-orm';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';
import { LotBusyError } from '../../domain/lots/LotBusyError.ts';
import type { Database, Transaction } from './database.ts';
import { isLockTimeout, LIMIT_LOCK_WAIT } from './lockTimeout.ts';

// Under REPEATABLE READ the statements after the lock wait would read a snapshot older than the previous holder's commit.
export const LOT_LOCK_TRANSACTION = { isolationLevel: 'read committed' } as const satisfies PgTransactionConfig;

export interface LockedParkingLot {
  readonly id: string;
  readonly name: string;
  readonly isOnline: boolean;
  readonly capacity: number;
  readonly vehicleCount: number;
  readonly holdQuota: number;
}

interface LockedParkingLotRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly is_online: boolean;
  readonly capacity: number;
  readonly vehicle_count: number;
  readonly hold_quota: number;
}

// Lot, then session, then spot: the order a loop closure, the cancellation job, an entry and a spot hold all take.
// The row is read under the lock, so a spot hold re-checks the lot as the previous holder left it; undefined for an unknown lot.
export async function lockParkingLot(tx: Pick<Transaction, 'execute'>, lotId: string): Promise<LockedParkingLot | undefined> {
  const rows = await tx.execute<LockedParkingLotRow>(sql`
    select id, name, is_online, capacity, vehicle_count, hold_quota from parking_lot where id = ${lotId} for no key update`);
  const row = rows[0];
  return row === undefined ? undefined : lockedParkingLotOf(row);
}

function lockedParkingLotOf(row: LockedParkingLotRow): LockedParkingLot {
  return { id: row.id, name: row.name, isOnline: row.is_online, capacity: row.capacity, vehicleCount: row.vehicle_count, holdQuota: row.hold_quota };
}

// Runs the work under the lot lock, waiting for it at most LIMIT_LOCK_WAIT.
export function inLotLock<T>(database: Database, lotId: string, work: (tx: Transaction) => Promise<T>): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(LIMIT_LOCK_WAIT);
    await lockParkingLot(tx, lotId);
    return work(tx);
  }, LOT_LOCK_TRANSACTION);
}

export const LOT_BUSY = { outcome: 'lot-busy' } as const;

export function isLotBusy(result: unknown): result is typeof LOT_BUSY {
  return result === LOT_BUSY;
}

// A lock wait past the limit is a retryable refusal, the lot being busy; any other failure stays one.
export async function orLotBusy<T>(work: Promise<T>): Promise<T | typeof LOT_BUSY> {
  try {
    return await work;
  } catch (error) {
    if (isLockTimeout(error)) {
      return LOT_BUSY;
    }
    throw error;
  }
}

// For the periodic jobs, whose domain loop logs a busy lot apart from a real failure.
export async function orLotBusyError<T>(lotId: string, work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    throw isLockTimeout(error) ? new LotBusyError(lotId, { cause: error }) : error;
  }
}
