import type { DashboardSpotsToCheck, DashboardSpotToCheck, SpotCheckReason } from '@palier/shared-types';
import { clearDecisionOf } from '../../domain/dashboard/clearDecisionOf.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';

interface SpotToCheckColumns {
  readonly id: string;
  readonly number: string;
  readonly level_code: string;
  readonly aisle_code: string;
  readonly needs_check_since: Date | string;
  readonly needs_check_reason: SpotCheckReason | null;
  readonly state: SpotState;
  readonly held_by_session: boolean;
}

type NoSpotColumns = { readonly [Column in keyof SpotToCheckColumns]: null };

export type SpotToCheckRow = Record<string, unknown> & { readonly lot_name: string } & (SpotToCheckColumns | NoSpotColumns);

// A lot with no flagged spot comes back as one row of null spot columns, which still names the lot.
export function spotsToCheckOf(rows: readonly SpotToCheckRow[]): DashboardSpotsToCheck {
  return { lotName: rows[0]?.lot_name ?? '', spots: rows.flatMap(spotToCheckOf) };
}

function spotToCheckOf(row: SpotToCheckRow): DashboardSpotToCheck[] {
  if (row.id === null) {
    return [];
  }
  return [
    {
      spotId: row.id,
      number: row.number,
      levelCode: row.level_code,
      aisleCode: row.aisle_code,
      since: new Date(row.needs_check_since).toISOString(),
      reason: row.needs_check_reason,
      state: row.state,
      clearable: clearDecisionOf({ state: row.state, needsCheck: true, heldBySession: row.held_by_session }) === 'CLEAR',
      heldBySession: row.held_by_session,
    },
  ];
}
