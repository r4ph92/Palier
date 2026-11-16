import { sql, type SQL } from 'drizzle-orm';
import type { SessionPage } from '../../domain/dashboard/SessionTimelineRepository.ts';
import { activeSessionOf } from './activeSessionStates.ts';

// A visit writes about ten events; the bound only keeps a runaway log from filling a response.
export const EVENTS_PER_SESSION_LIMIT = 200;

// Never user_id, vehicle_id, payment_intent_id, card_last4 or a hold id: the dashboard shows what happened in the lot, not who paid how.
const SESSION_COLUMNS = sql`ps.id, ps.plate, ps.state, ps.entry_scan_at, ps.exit_at,
  assigned.number as assigned_spot_number, confirmed.number as confirmed_spot_number,
  ps.presumed_by, ps.parked_answered_at is not null as was_answered, ps.exit_identification,
  ps.captured_cents, ps.surplus_paid_cents, ps.pending_capture_cents, ps.pending_surplus_cents, ps.unpaid_cents`;

function sessionsOfOwnedLot(operatorId: string, lotId: string): SQL {
  return sql`from parking_session ps
    join parking_lot on parking_lot.id = ps.lot_id and parking_lot.operator_id = ${operatorId}
    join spot assigned on assigned.id = ps.assigned_spot_id
    left join spot confirmed on confirmed.id = ps.confirmed_spot_id
    where ps.lot_id = ${lotId}`;
}

export function readOwnedLotNameStatement(operatorId: string, lotId: string): SQL {
  return sql`select parking_lot.name as lot_name from parking_lot where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}`;
}

function statusFilterOf({ status }: SessionPage): SQL {
  return status === 'OPEN' ? activeSessionOf('ps') : sql`true`;
}

// Keyset paging from the last id seen, looked up in this lot only: an id of another lot, or none, finds no row and the page is empty.
function afterCursorOf({ before }: SessionPage, lotId: string): SQL {
  if (before === null) {
    return sql`true`;
  }
  return sql`(ps.entry_scan_at, ps.id) < (select last_seen.entry_scan_at, last_seen.id from parking_session last_seen where last_seen.id = ${before} and last_seen.lot_id = ${lotId})`;
}

export function listSessionsStatement(operatorId: string, lotId: string, page: SessionPage): SQL {
  return sql`select ${SESSION_COLUMNS}
    ${sessionsOfOwnedLot(operatorId, lotId)} and ${statusFilterOf(page)} and ${afterCursorOf(page, lotId)}
    order by ps.entry_scan_at desc, ps.id desc
    limit ${page.limit}`;
}

export function readSessionStatement(operatorId: string, lotId: string, sessionId: string): SQL {
  return sql`select ${SESSION_COLUMNS}
    ${sessionsOfOwnedLot(operatorId, lotId)} and ps.id = ${sessionId}`;
}

// In the order of writing: the sequence, never the instant of each step (decision 037).
export function readSessionEventsStatement(operatorId: string, lotId: string, sessionId: string): SQL {
  return sql`select event_log.sequence, event_log.kind, event_log.payload, event_log.occurred_at
    from event_log
    join parking_lot on parking_lot.id = event_log.lot_id and parking_lot.operator_id = ${operatorId}
    where event_log.session_id = ${sessionId} and event_log.lot_id = ${lotId}
    order by event_log.sequence
    limit ${EVENTS_PER_SESSION_LIMIT}`;
}
