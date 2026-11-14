import type { DashboardLotMap, DashboardMapAisle, DashboardMapLevel } from '@palier/shared-types';
import { PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';
import { aisleRectangleOf } from '../../domain/lots/AisleRectangle.ts';

export interface LotMapRow extends Record<string, unknown> {
  readonly lot_name: string;
  readonly beacon_major: number | null;
  readonly level_id: string | null;
  readonly level_code: string | null;
  readonly display_order: number | null;
  readonly aisle_id: string | null;
  readonly aisle_code: string | null;
  readonly beacon_minor: number | null;
  readonly is_exit_lane: boolean | null;
  readonly map_polygon: unknown;
}

type LevelRow = LotMapRow & { readonly level_id: string; readonly level_code: string; readonly display_order: number };
type AisleRow = LevelRow & { readonly aisle_id: string; readonly aisle_code: string; readonly beacon_minor: number; readonly is_exit_lane: boolean };

// Rows come ordered by level then aisle; null when the operator has no lot with this id.
export function lotMapOf(lotId: string, rows: readonly LotMapRow[]): DashboardLotMap | null {
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  return { lotId, lotName: first.lot_name, platformUuid: PLATFORM_BEACON_UUID, beaconMajor: first.beacon_major, levels: levelsOf(rows) };
}

function levelsOf(rows: readonly LotMapRow[]): DashboardMapLevel[] {
  const levels = new Map<string, DashboardMapLevel & { readonly aisles: DashboardMapAisle[] }>();
  for (const row of rows.filter(isLevelRow)) {
    const level = levels.get(row.level_id) ?? { id: row.level_id, code: row.level_code, displayOrder: row.display_order, aisles: [] };
    levels.set(row.level_id, level);
    if (isAisleRow(row)) {
      level.aisles.push(aisleOf(row));
    }
  }
  return [...levels.values()];
}

// A shape the read boundary refuses is shown undrawn, like the exit lane.
function aisleOf(row: AisleRow): DashboardMapAisle {
  const reading = aisleRectangleOf(row.map_polygon);
  const rectangle = reading.kind === 'drawn' ? reading.rectangle : null;
  return { id: row.aisle_id, code: row.aisle_code, beaconMinor: row.beacon_minor, isExitLane: row.is_exit_lane, rectangle };
}

function isLevelRow(row: LotMapRow): row is LevelRow {
  return row.level_id !== null;
}

function isAisleRow(row: LevelRow): row is AisleRow {
  return row.aisle_id !== null;
}
