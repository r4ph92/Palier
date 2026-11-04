import { sql } from 'drizzle-orm';
import type { Transaction } from './database.ts';

interface CancelledSessionRow extends Record<string, unknown> {
  readonly assigned_spot_id: string;
}

// The one cancellation path, for an entry rolled back and for one nobody drove through. A session already confirmed or
// cancelled is left alone. A hold, if one was attached, is marked for the cancellation job to release.
export async function cancelCreatedSession(tx: Transaction, sessionId: string): Promise<boolean> {
  const rows = await tx.execute<CancelledSessionRow>(sql`
    update parking_session
    set state = 'CANCELLED', cancelled_at = now(), hold_release_pending = payment_intent_id is not null
    where id = ${sessionId} and state = 'CREATED'
    returning assigned_spot_id`);
  const cancelled = rows[0];
  if (cancelled === undefined) {
    return false;
  }
  await tx.execute(sql`
    update spot set state = 'AVAILABLE', state_changed_at = now()
    where id = ${cancelled.assigned_spot_id} and state = 'ASSIGNED'`);
  return true;
}
