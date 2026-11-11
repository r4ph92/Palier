import { sql } from 'drizzle-orm';
import type { LotOccupancy } from '../../domain/occupancy/hasRoomForAnotherVehicle.ts';
import type { Transaction } from './database.ts';
import { assignedSpotCountOf, heldSpotCountOf } from './heldSpotCount.ts';

interface LotOccupancyRow extends Record<string, unknown> {
  readonly capacity: number;
  readonly vehicle_count: number;
  readonly held_spot_count: number;
  readonly assigned_spot_count: number;
}

// Under the lot lock, nothing that changes these counts (entry, loop closure, cancellation, hold) can run before the caller decides.
export async function readLotOccupancy(tx: Pick<Transaction, 'execute'>, lotId: string): Promise<LotOccupancy | undefined> {
  const rows = await tx.execute<LotOccupancyRow>(sql`
    select capacity, vehicle_count, ${heldSpotCountOf(lotId)} as held_spot_count, ${assignedSpotCountOf(lotId)} as assigned_spot_count
    from parking_lot where id = ${lotId}`);
  const row = rows[0];
  return row === undefined
    ? undefined
    : { capacity: row.capacity, vehicleCount: row.vehicle_count, heldSpotCount: row.held_spot_count, assignedSpotCount: row.assigned_spot_count };
}
