import { sql, type SQL } from 'drizzle-orm';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';

// One condition, on the database clock, for both sides: a loop closure confirms what it holds, the cancellation job takes the rest.
export function isWithinOpeningWindow(moment: SQL, window: OpeningWindow): SQL {
  return sql`${moment} >= now() - (${window.withinMilliseconds}::int * interval '1 millisecond')`;
}
