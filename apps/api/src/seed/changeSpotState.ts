import { and, count, eq, inArray, ne, or } from 'drizzle-orm';
import type { Database, Transaction } from '../infrastructure/postgres/database.ts';
import { ACTIVE_SESSION } from '../infrastructure/postgres/activeSessionStates.ts';
import { parkingLot, parkingSession, spot } from '../infrastructure/postgres/schema.ts';
import { activeSessionRefusal, decideActiveSessionRule } from './activeSessionRule.ts';
import type { SpotStateChange } from './spotStateArguments.ts';

// A held spot belongs to its hold until the hold ends (released or expired): changing it by hand would orphan the hold.
// The spot row is locked before the active sessions are counted: an entry skips it meanwhile (its claim is FOR UPDATE SKIP LOCKED) and a
// parked answer waits for this change, so no session lands on a spot this script frees.
export async function changeSpotState(database: Database, change: SpotStateChange): Promise<{ readonly activeSessionStillPoints: boolean }> {
  return database.transaction(async (tx) => {
    const lotsWithName = tx.select({ id: parkingLot.id }).from(parkingLot).where(eq(parkingLot.name, change.lotName));
    const spotNamed = and(inArray(spot.lotId, lotsWithName), eq(spot.number, change.spotNumber), ne(spot.state, 'HELD'));
    // Lot names are not unique: every spot of that number in a lot of that name changes, as before.
    const lockedIds = (await tx.select({ id: spot.id }).from(spot).where(spotNamed).for('update')).map((row) => row.id);
    if (lockedIds.length === 0) {
      throw new Error(`No spot ${change.spotNumber} in a lot named "${change.lotName}", or a driver holds it.`);
    }
    const decision = decideActiveSessionRule(change, await countActiveSessionsOnSpots(tx, lockedIds));
    if (decision === 'refuse') {
      throw new Error(activeSessionRefusal(change));
    }
    await tx.update(spot).set({ state: change.state, stateChangedAt: new Date() }).where(inArray(spot.id, lockedIds));
    return { activeSessionStillPoints: decision === 'change-and-warn' };
  });
}

// A session holds the spot it was assigned and the one the driver said they parked in.
async function countActiveSessionsOnSpots(tx: Transaction, spotIds: readonly string[]): Promise<number> {
  const [row] = await tx
    .select({ total: count() })
    .from(parkingSession)
    .where(and(ACTIVE_SESSION, or(inArray(parkingSession.assignedSpotId, spotIds), inArray(parkingSession.confirmedSpotId, spotIds))));
  return row?.total ?? 0;
}
