import { and, count, eq, inArray, ne, or } from 'drizzle-orm';
import type { Database, Transaction } from '../infrastructure/postgres/database.ts';
import { ACTIVE_SESSION } from '../infrastructure/postgres/activeSessionStates.ts';
import { parkingLot, parkingSession, spot } from '../infrastructure/postgres/schema.ts';
import { activeSessionRefusal, decideActiveSessionRule } from './activeSessionRule.ts';
import type { SpotStateChange } from './spotStateArguments.ts';

// A held spot belongs to its hold until the hold ends (released or expired): changing it by hand would orphan the hold.
// The spot row is locked before the active sessions are counted: an entry claiming it meanwhile either waits for this change or skips
// the spot (its claim is FOR UPDATE SKIP LOCKED), so no session lands on a spot this script frees.
export async function changeSpotState(database: Database, change: SpotStateChange): Promise<{ readonly activeSessionStillPoints: boolean }> {
  return database.transaction(async (tx) => {
    const lotsWithName = tx.select({ id: parkingLot.id }).from(parkingLot).where(eq(parkingLot.name, change.lotName));
    const spotNamed = and(inArray(spot.lotId, lotsWithName), eq(spot.number, change.spotNumber), ne(spot.state, 'HELD'));
    const [locked] = await tx.select({ id: spot.id }).from(spot).where(spotNamed).for('update');
    if (locked === undefined) {
      throw new Error(`No spot ${change.spotNumber} in a lot named "${change.lotName}", or a driver holds it.`);
    }
    const decision = decideActiveSessionRule(change, await countActiveSessionsOnSpot(tx, locked.id));
    if (decision === 'refuse') {
      throw new Error(activeSessionRefusal(change));
    }
    await tx.update(spot).set({ state: change.state, stateChangedAt: new Date() }).where(eq(spot.id, locked.id));
    return { activeSessionStillPoints: decision === 'change-and-warn' };
  });
}

// A session holds the spot it was assigned and the one the driver said they parked in.
async function countActiveSessionsOnSpot(tx: Transaction, spotId: string): Promise<number> {
  const [row] = await tx
    .select({ total: count() })
    .from(parkingSession)
    .where(and(ACTIVE_SESSION, or(eq(parkingSession.assignedSpotId, spotId), eq(parkingSession.confirmedSpotId, spotId))));
  return row?.total ?? 0;
}
