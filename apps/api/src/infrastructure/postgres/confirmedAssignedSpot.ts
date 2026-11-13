import { sql, type SQL } from 'drizzle-orm';

// The story counts an ASSIGNED spot only once its session is ENTRY_CONFIRMED; any other ASSIGNED spot is an entry whose loop has not closed (see heldSpotCount.ts).
export function confirmedAssignedSpotOf(): SQL<boolean> {
  return sql<boolean>`(spot.state = 'ASSIGNED' and exists (select 1 from parking_session where parking_session.assigned_spot_id = spot.id and parking_session.state = 'ENTRY_CONFIRMED'))`;
}
