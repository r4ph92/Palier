import { sql, type SQL } from 'drizzle-orm';
import { activeSessionOf } from './activeSessionStates.ts';

// An active session has the spot as its assigned or its confirmed one, whatever state the spot row shows.
// With exceptSessionId, that session is not counted: a session may confirm the spot it holds itself.
export function sessionHoldsSpot(spotAlias: 'spot' | 's', exceptSessionId?: string): SQL {
  const spotId = sql.raw(`${spotAlias}.id`);
  const otherThanAsker = exceptSessionId === undefined ? sql`` : sql` and holder.id <> ${exceptSessionId}`;
  return sql`exists (select 1 from parking_session holder where (holder.assigned_spot_id = ${spotId} or holder.confirmed_spot_id = ${spotId})${otherThanAsker} and ${activeSessionOf('holder')})`;
}

// Also a spot an active session reported taken: that session's exit frees it (spotsFreedOnExit), so its check waits for that exit.
export function sessionHoldsOrReportedSpot(): SQL {
  return sql`(${sessionHoldsSpot('spot')} or exists (select 1 from parking_session_reported_spot reported join parking_session reporter on reporter.id = reported.session_id where reported.spot_id = spot.id and reported.lot_id = spot.lot_id and ${activeSessionOf('reporter')}))`;
}
