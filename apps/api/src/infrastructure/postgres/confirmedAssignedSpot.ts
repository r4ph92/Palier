import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

// An ASSIGNED spot counts as taken only once its session's loop has closed (ENTRY_CONFIRMED); before that the vehicle may not have come in.
export function confirmedAssignedSpotOf(spotId: SQLWrapper): SQL<boolean> {
  return sql<boolean>`(spot.state = 'ASSIGNED' and exists (select 1 from parking_session where parking_session.assigned_spot_id = ${spotId} and parking_session.state = 'ENTRY_CONFIRMED'))`;
}
