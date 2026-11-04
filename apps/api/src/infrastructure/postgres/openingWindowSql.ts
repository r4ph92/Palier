import { sql, type SQL } from 'drizzle-orm';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';

// One condition, on the database clock, for both sides: a loop closure confirms what it holds, the cancellation job takes the rest.
export function isWithinOpeningWindow(moment: SQL, window: OpeningWindow): SQL {
  return sql`${moment} >= now() - (${window.withinMilliseconds}::int * interval '1 millisecond')`;
}

// The opening is the barrier command; a session without one (a crash between the spot and the command, or an entry
// still waiting on its card hold) is judged from its scan.
export function entryOpenedAt(sessionAlias: string): SQL {
  const session = sql.identifier(sessionAlias);
  return sql`coalesce((select max(c.issued_at) from gate_command c where c.session_id = ${session}.id and c.kind = 'OPEN'), ${session}.entry_scan_at)`;
}
