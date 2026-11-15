import { and, count, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Database, Transaction } from '../infrastructure/postgres/database.ts';
import { ACTIVE_SESSION } from '../infrastructure/postgres/activeSessionStates.ts';
import { isLiveSpot } from '../infrastructure/postgres/liveSpot.ts';
import { parkingLot, parkingSession, spot, type SpotState } from '../infrastructure/postgres/schema.ts';
import { activeSessionRefusal, decideActiveSessionRule } from './activeSessionRule.ts';
import type { SpotStateChange } from './spotStateArguments.ts';

// A held spot belongs to its hold until the hold ends (released or expired): changing it by hand would orphan the hold.
// The spot row is locked before the active sessions are counted: an entry skips it meanwhile (its claim is FOR UPDATE SKIP LOCKED) and a
// parked answer waits for this change, so no session lands on a spot this script frees.
export async function changeSpotState(database: Database, change: SpotStateChange): Promise<{ readonly activeSessionStillPoints: boolean }> {
  return database.transaction(async (tx) => {
    const lotsWithName = tx.select({ id: parkingLot.id }).from(parkingLot).where(eq(parkingLot.name, change.lotName));
    const spotNamed = liveSpotNamed(inArray(spot.lotId, lotsWithName), change.spotNumber);
    // Lot names are not unique: every spot of that number in a lot of that name changes, as before.
    const lockedIds = (await tx.select({ id: spot.id }).from(spot).where(spotNamed).for('update')).map((row) => row.id);
    if (lockedIds.length === 0) {
      throw new Error(`No spot ${change.spotNumber} in a lot named "${change.lotName}", or a driver holds it.`);
    }
    const decision = decideActiveSessionRule(change, await countActiveSessionsOnSpots(tx, lockedIds));
    if (decision === 'refuse') {
      throw new Error(activeSessionRefusal(change));
    }
    await tx.update(spot).set({ state: change.state, stateChangedAt: new Date(), ...flagOf(change.state) }).where(inArray(spot.id, lockedIds));
    return { activeSessionStillPoints: decision === 'change-and-warn' };
  });
}

// What the exit and the parked answer write when a spot turns occupied-unknown: it is flagged for a check, its first time kept, no reason recorded.
function flagOf(state: SpotState): { readonly needsCheck?: true; readonly needsCheckSince?: SQL } {
  return state === 'OCCUPIED_UNKNOWN' ? { needsCheck: true, needsCheckSince: sql`coalesce(${spot.needsCheckSince}, now())` } : {};
}

// A session holds the spot it was assigned and the one the driver said they parked in.
async function countActiveSessionsOnSpots(tx: Transaction, spotIds: readonly string[]): Promise<number> {
  const [row] = await tx
    .select({ total: count() })
    .from(parkingSession)
    .where(and(ACTIVE_SESSION, or(inArray(parkingSession.assignedSpotId, spotIds), inArray(parkingSession.confirmedSpotId, spotIds))));
  return row?.total ?? 0;
}

function liveSpotNamed(inLot: SQL, spotNumber: string): SQL | undefined {
  return and(inLot, eq(spot.number, spotNumber), isLiveSpot, ne(spot.state, 'HELD'));
}
