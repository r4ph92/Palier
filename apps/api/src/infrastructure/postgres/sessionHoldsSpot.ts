import { sql, type SQL } from 'drizzle-orm';
import { activeSessionOf } from './activeSessionStates.ts';

// An active session has the spot as its assigned or its confirmed one, whatever state the spot row shows.
export function sessionHoldsSpot(spotAlias: 'spot' | 's'): SQL {
  const spotId = sql.raw(`${spotAlias}.id`);
  return sql`exists (select 1 from parking_session holder where (holder.assigned_spot_id = ${spotId} or holder.confirmed_spot_id = ${spotId}) and ${activeSessionOf('holder')})`;
}
