import { sql } from 'drizzle-orm';
import type { ActiveEntrySessionState } from '@palier/shared-types';
import type { ActiveSessionFacts } from '../../domain/entries/decideRepeatedScan.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Transaction } from './database.ts';
import { entryOpenedAt, isWithinOpeningWindow } from './openingWindowSql.ts';

interface ActiveSessionRow extends Record<string, unknown> {
  readonly id: string;
  readonly lot_id: string;
  readonly entry_gate_id: string;
  readonly state: ActiveEntrySessionState;
  readonly is_within_opening_window: boolean;
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
}

// The active session is filtered alone first, with the index's own condition, before the joins (docs/decisions/007).
export async function findActiveSessionFacts(tx: Transaction, driverId: string, window: OpeningWindow): Promise<ActiveSessionFacts | null> {
  const rows = await tx.execute<ActiveSessionRow>(sql`
    with active as (select * from parking_session where user_id = ${driverId} and ${ACTIVE_SESSION} limit 1)
    select s.id, s.lot_id, s.entry_gate_id, s.state, ${isWithinOpeningWindow(entryOpenedAt('s'), window)} as is_within_opening_window,
      spot.number, aisle.code as aisle_code, level.code as level_code
    from active s
    join spot on spot.id = s.assigned_spot_id
    join aisle on aisle.id = spot.aisle_id
    join level on level.id = aisle.level_id`);
  const row = rows[0];
  return row === undefined ? null : factsOf(row);
}

function factsOf(row: ActiveSessionRow): ActiveSessionFacts {
  return {
    id: row.id,
    lotId: row.lot_id,
    entryGateId: row.entry_gate_id,
    state: row.state,
    isWithinOpeningWindow: row.is_within_opening_window,
    spot: { number: row.number, levelCode: row.level_code, aisleCode: row.aisle_code },
  };
}
