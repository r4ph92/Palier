import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import type { SpotState } from '../../domain/spots/spotStates.ts';

interface SpotColumns {
  readonly id: string;
  readonly number: string;
  readonly state: SpotState;
  readonly is_ev: boolean;
  readonly is_accessible: boolean;
  readonly is_oversize: boolean;
  readonly distance_to_exit: number;
}

type NullSpotColumns = { readonly [Column in keyof SpotColumns]: null };

export type AisleSpotRow = Record<string, unknown> & {
  readonly aisle_id: string;
  readonly capacity: number;
  readonly spot_count: number;
} & (SpotColumns | NullSpotColumns);

// Rows come in natural order; null when the aisle is not one of the operator's parking aisles.
export function aisleSpotsOf(rows: readonly AisleSpotRow[]): DashboardAisleSpots | null {
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  return { aisleId: first.aisle_id, spots: rows.flatMap(spotOf), spotCount: first.spot_count, capacity: first.capacity };
}

function spotOf(row: AisleSpotRow): DashboardSpot[] {
  if (row.id === null) {
    return [];
  }
  const { id, number, state, is_ev: isEv, is_accessible: isAccessible, is_oversize: isOversize, distance_to_exit: distanceToExit } = row;
  return [{ id, number, state, isEv, isAccessible, isOversize, distanceToExit }];
}
