import { sql } from 'drizzle-orm';
import { spotsFreedOnExit, type SpotOfExit } from '../../domain/exits/spotsFreedOnExit.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';
import { activeSessionOf } from './activeSessionStates.ts';
import type { Transaction } from './database.ts';

// The spots of a session that just closed: by the driver at the exit gate, or by an operator at its last proof (decision 043).
export interface ClosedSessionRow extends Record<string, unknown> {
  readonly assigned_spot_id: string;
  readonly confirmed_spot_id: string | null;
}

interface SpotRow extends Record<string, unknown> {
  readonly id: string;
  readonly state: SpotState;
  readonly held_by_another_session: boolean;
}

interface SpotsToFree {
  readonly sessionId: string;
  readonly session: ClosedSessionRow;
  readonly now: Date;
}

// The car's spot is the confirmed one once the driver answered, the assigned one before; the others are the history of the session.
export async function freeSpots(tx: Transaction, { sessionId, session, now }: SpotsToFree): Promise<void> {
  const ownSpotId = session.confirmed_spot_id ?? session.assigned_spot_id;
  const freed = spotsFreedOnExit(ownSpotId, await lockSpotsOfSession(tx, sessionId, session));
  if (freed.length === 0) {
    return;
  }
  await tx.execute(sql`
    update spot set needs_check = needs_check or state = 'OCCUPIED_UNKNOWN',
      needs_check_since = coalesce(needs_check_since, case when state = 'OCCUPIED_UNKNOWN' then ${now.toISOString()}::timestamptz end),
      state = 'AVAILABLE', state_changed_at = ${now.toISOString()}::timestamptz
    where id in (${sql.join(freed.map((id) => sql`${id}`), sql`, `)})`);
}

async function lockSpotsOfSession(tx: Transaction, sessionId: string, session: ClosedSessionRow): Promise<SpotOfExit[]> {
  const ownSpotId = session.confirmed_spot_id ?? session.assigned_spot_id;
  const rows = await tx.execute<SpotRow>(sql`
    select spot.id, spot.state,
      exists (
        select 1 from parking_session other
        where other.id <> ${sessionId} and ${activeSessionOf('other')} and (other.assigned_spot_id = spot.id or other.confirmed_spot_id = spot.id)
      ) as held_by_another_session
    from spot
    where spot.id = ${ownSpotId} or spot.id = ${session.assigned_spot_id}
      or spot.id in (select spot_id from parking_session_reported_spot where session_id = ${sessionId})
    order by spot.id
    for update of spot`);
  return rows.map((row) => ({ id: row.id, state: row.state, heldByAnotherSession: row.held_by_another_session }));
}
