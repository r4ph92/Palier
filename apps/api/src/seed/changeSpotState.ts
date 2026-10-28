import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../infrastructure/postgres/database.ts';
import { parkingLot, spot } from '../infrastructure/postgres/schema.ts';
import type { SpotStateChange } from './spotStateArguments.ts';

export async function changeSpotState(database: Database, change: SpotStateChange): Promise<void> {
  const lotsWithName = database.select({ id: parkingLot.id }).from(parkingLot).where(eq(parkingLot.name, change.lotName));
  const updated = await database
    .update(spot)
    .set({ state: change.state, stateChangedAt: new Date() })
    .where(and(inArray(spot.lotId, lotsWithName), eq(spot.number, change.spotNumber)))
    .returning({ id: spot.id });
  if (updated.length === 0) {
    throw new Error(`No spot ${change.spotNumber} in a lot named "${change.lotName}".`);
  }
}
