import type { DashboardSpotToCheck, SpotCheckReason } from '@palier/shared-types';
import type { SpotState } from '../../domain/spots/spotStates.ts';

interface SpotToCheckColumns {
  readonly id: string;
  readonly number: string;
  readonly level_code: string;
  readonly aisle_code: string;
  readonly needs_check_since: Date | string;
  readonly needs_check_reason: SpotCheckReason | null;
  readonly state: SpotState;
}

type NoSpotColumns = { readonly [Column in keyof SpotToCheckColumns]: null };

export type SpotToCheckRow = Record<string, unknown> & (SpotToCheckColumns | NoSpotColumns);

// A lot with no flagged spot comes back as one row of null spot columns.
export function spotsToCheckOf(rows: readonly SpotToCheckRow[]): readonly DashboardSpotToCheck[] {
  return rows.flatMap(spotToCheckOf);
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
    },
  ];
}
