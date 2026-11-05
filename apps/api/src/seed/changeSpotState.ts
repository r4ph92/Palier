import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Database } from '../infrastructure/postgres/database.ts';
import { parkingLot, spot } from '../infrastructure/postgres/schema.ts';
import type { SpotStateChange } from './spotStateArguments.ts';

// A held spot belongs to its hold until the hold ends (released or expired): changing it by hand would orphan the hold.
export async function changeSpotState(database: Database, change: SpotStateChange): Promise<void> {
  const lotsWithName = database.select({ id: parkingLot.id }).from(parkingLot).where(eq(parkingLot.name, change.lotName));
  const updated = await database
    .update(spot)
    .set({ state: change.state, stateChangedAt: new Date() })
    .where(and(inArray(spot.lotId, lotsWithName), eq(spot.number, change.spotNumber), ne(spot.state, 'HELD')))
    .returning({ id: spot.id });
  if (updated.length === 0) {
    throw new Error(`No spot ${change.spotNumber} in a lot named "${change.lotName}", or a driver holds it.`);
  }
}
