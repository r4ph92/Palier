import { sql, type SQL } from 'drizzle-orm';
import type { PresenceCheck } from '../../domain/dashboard/StaleSessionReviewRepository.ts';
import { STALE_SESSION_LIST_LIMIT } from '@palier/shared-types/staleSessions';
import { ACTIVE_SESSION, activeSessionOf } from './activeSessionStates.ts';

// One row per open flagged session, oldest flag first, or one row of null session columns for a lot with none; no row for a lot that is not the operator's.
// Never user_id, vehicle_id, payment_intent_id or card_last4: the page shows what is in the lot, not who paid how.
export function readStaleSessionsStatement(operatorId: string, lotId: string): SQL {
  return sql`
    select parking_lot.name as lot_name, ps.id, ps.plate, spot.number, aisle.code as aisle_code, level.code as level_code,
      ps.entry_confirmed_at, ps.parked_at, ps.presumed_by, ps.parked_answered_at, ps.presence_confirmed_at, ps.stale_flagged_at
    from parking_lot
    left join parking_session ps on ps.lot_id = parking_lot.id and ps.stale_flagged_at is not null and ${activeSessionOf('ps')}
    left join spot on spot.id = coalesce(ps.confirmed_spot_id, ps.assigned_spot_id)
    left join aisle on aisle.id = spot.aisle_id
    left join level on level.id = aisle.level_id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
    order by ps.stale_flagged_at, ps.id
    limit ${STALE_SESSION_LIST_LIMIT}`;
}

// Locks the session row, so a second click waits for the first and then finds the flag already cleared. Closed sessions and other lots' sessions give no row.
export function lockSessionToConfirmStatement({ lotId, sessionId }: PresenceCheck): SQL {
  return sql`
    select stale_flagged_at is not null as flagged
    from parking_session
    where id = ${sessionId} and lot_id = ${lotId} and ${ACTIVE_SESSION}
    for update`;
}

export function confirmPresenceStatement({ lotId, sessionId, memberId, confirmedAt }: PresenceCheck): SQL {
  return sql`
    update parking_session
    set presence_confirmed_at = ${confirmedAt.toISOString()}::timestamptz, presence_confirmed_by = ${memberId}, stale_flagged_at = null
    where id = ${sessionId} and lot_id = ${lotId}
    returning id`;
}
