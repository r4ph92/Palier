import { sql } from 'drizzle-orm';
import { check, type AnyPgColumn } from 'drizzle-orm/pg-core';

interface StateColumns {
  readonly state: AnyPgColumn;
  readonly parkedAisleId: AnyPgColumn;
  readonly parkedAskedAt: AnyPgColumn;
  readonly presumedBy: AnyPgColumn;
  readonly confirmedSpotId: AnyPgColumn;
  readonly parkedAnsweredAt: AnyPgColumn;
  readonly exitAt: AnyPgColumn;
  readonly exitIdentification: AnyPgColumn;
  readonly capturedCents: AnyPgColumn;
  readonly pendingCaptureCents: AnyPgColumn;
  readonly staffClosedBy: AnyPgColumn;
}

// Compared as text: a check on the enum itself would block the next migration that recreates the enum.
export function stateChecks(table: StateColumns) {
  return [
    check('parking_session_unconfirmed_has_aisle', sql`${table.state}::text <> 'PARKED_UNCONFIRMED' or ${table.parkedAisleId} is not null`),
    check('parking_session_unconfirmed_has_question', sql`${table.state}::text <> 'PARKED_UNCONFIRMED' or ${table.parkedAskedAt} is not null`),
    check('parking_session_presumed_has_evidence', sql`${table.state}::text <> 'PARKED_PRESUMED' or ${table.presumedBy} is not null`),
    check(
      'parking_session_confirmed_has_spot',
      sql`${table.state}::text <> 'PARKED_CONFIRMED' or (${table.confirmedSpotId} is not null and ${table.parkedAnsweredAt} is not null)`,
    ),
    ...closedStateChecks(table),
  ];
}

// How a closed session must have ended, one check per closed state.
function closedStateChecks(table: StateColumns) {
  return [
    // A paid session always says when, how and how much.
    check(
      'parking_session_paid_has_exit',
      sql`${table.state}::text <> 'CLOSED_PAID' or (${table.exitAt} is not null and ${table.exitIdentification} is not null and ${table.capturedCents} is not null)`,
    ),
    // A session left with its capture pending says when, how, and the amount the retry takes (decision 026).
    check(
      'parking_session_pending_has_exit',
      sql`${table.state}::text <> 'CLOSED_CAPTURE_PENDING' or (${table.exitAt} is not null and ${table.exitIdentification} is not null and ${table.pendingCaptureCents} is not null)`,
    ),
    // A session an operator closed at its last proof says when, that it was staff, and who; it never captured (decision 043).
    check(
      'parking_session_closed_by_staff_has_exit',
      sql`${table.state}::text <> 'CLOSED_BY_STAFF' or (${table.exitAt} is not null and ${table.exitIdentification}::text = 'STAFF' and ${table.staffClosedBy} is not null and ${table.capturedCents} is null)`,
    ),
  ];
}
