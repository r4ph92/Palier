import { and, count, eq, inArray, ne, or } from 'drizzle-orm';
import type { Database } from '../infrastructure/postgres/database.ts';
import { ACTIVE_SESSION } from '../infrastructure/postgres/activeSessionStates.ts';
import { parkingLot, parkingSession, spot } from '../infrastructure/postgres/schema.ts';
import { activeSessionRefusal, decideActiveSessionRule } from './activeSessionRule.ts';
import type { SpotStateChange } from './spotStateArguments.ts';

// A held spot belongs to its hold until the hold ends (released or expired): changing it by hand would orphan the hold.
export async function changeSpotState(database: Database, change: SpotStateChange): Promise<{ readonly activeSessionStillPoints: boolean }> {
  const decision = decideActiveSessionRule(change, await countActiveSessionsOnSpot(database, change));
  if (decision === 'refuse') {
    throw new Error(activeSessionRefusal(change));
  }
  const lotsWithName = database.select({ id: parkingLot.id }).from(parkingLot).where(eq(parkingLot.name, change.lotName));
  const updated = await database
    .update(spot)
    .set({ state: change.state, stateChangedAt: new Date() })
    .where(and(inArray(spot.lotId, lotsWithName), eq(spot.number, change.spotNumber), ne(spot.state, 'HELD')))
    .returning({ id: spot.id });
  if (updated.length === 0) {
    throw new Error(`No spot ${change.spotNumber} in a lot named "${change.lotName}", or a driver holds it.`);
  }
  return { activeSessionStillPoints: decision === 'change-and-warn' };
}

// A session holds the spot it was assigned and the one the driver said they parked in. A HELD spot keeps its own refusal.
async function countActiveSessionsOnSpot(database: Database, change: SpotStateChange): Promise<number> {
  const lotsWithName = database.select({ id: parkingLot.id }).from(parkingLot).where(eq(parkingLot.name, change.lotName));
  const spotsNamed = database
    .select({ id: spot.id })
    .from(spot)
    .where(and(inArray(spot.lotId, lotsWithName), eq(spot.number, change.spotNumber), ne(spot.state, 'HELD')));
  const [row] = await database
    .select({ total: count() })
    .from(parkingSession)
    .where(and(ACTIVE_SESSION, or(inArray(parkingSession.assignedSpotId, spotsNamed), inArray(parkingSession.confirmedSpotId, spotsNamed))));
  return row?.total ?? 0;
}
