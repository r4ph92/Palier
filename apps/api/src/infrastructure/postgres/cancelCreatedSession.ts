import { sql } from 'drizzle-orm';
import type { Transaction } from './database.ts';

interface CancelledSessionRow extends Record<string, unknown> {
  readonly assigned_spot_id: string;
  readonly consumed_spot_hold_id: string | null;
}

// The one path for a rollback and the job: a session no longer CREATED is left alone, an attached hold is marked for release.
// Needs the lot lock. The driver never drove through, so the guarantee she used comes back (decision 016).
export async function cancelCreatedSession(tx: Transaction, sessionId: string, now: Date): Promise<boolean> {
  const rows = await tx.execute<CancelledSessionRow>(sql`
    update parking_session
    set state = 'CANCELLED', cancelled_at = now(), hold_release_pending = payment_intent_id is not null
    where id = ${sessionId} and state = 'CREATED'
    returning assigned_spot_id, consumed_spot_hold_id`);
  const cancelled = rows[0];
  if (cancelled === undefined) {
    return false;
  }
  const holdId = cancelled.consumed_spot_hold_id;
  const restored = holdId !== null && (await restoreSpotHold(tx, holdId, now));
  const moved = await setSpotState(tx, { spotId: cancelled.assigned_spot_id, state: restored ? 'HELD' : 'AVAILABLE', now });
  if (restored && !moved) {
    // The spot left ASSIGNED meanwhile: a hold must never be active on a spot that is not held.
    await tx.execute(sql`update spot_hold set status = 'USED' where id = ${holdId}`);
  }
  return true;
}

// Active again with its original end time; false when it ended meanwhile (then it expires, as a hold never used would) or the driver holds another spot now.
async function restoreSpotHold(tx: Transaction, spotHoldId: string, now: Date): Promise<boolean> {
  const at = now.toISOString();
  const restored = await tx.execute(sql`
    update spot_hold set status = 'ACTIVE'
    where id = ${spotHoldId} and status = 'USED' and expires_at > ${at}::timestamptz
      and not exists (select 1 from spot_hold other where other.user_id = spot_hold.user_id and other.status = 'ACTIVE')
    returning id`);
  if (restored.length === 1) {
    return true;
  }
  await tx.execute(sql`
    update spot_hold set status = 'EXPIRED' where id = ${spotHoldId} and status = 'USED' and expires_at <= ${at}::timestamptz`);
  return false;
}

interface SpotChange {
  readonly spotId: string;
  readonly state: 'HELD' | 'AVAILABLE';
  readonly now: Date;
}

async function setSpotState(tx: Transaction, { spotId, state, now }: SpotChange): Promise<boolean> {
  const rows = await tx.execute(sql`
    update spot set state = ${state}, state_changed_at = ${now.toISOString()}::timestamptz
    where id = ${spotId} and state = 'ASSIGNED'
    returning id`);
  return rows.length === 1;
}
