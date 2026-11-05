import type { AssignedSpot } from '@palier/shared-types';

export interface SpotLabelRow extends Record<string, unknown> {
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
}

export function spotOf(row: SpotLabelRow): AssignedSpot {
  return { number: row.number, levelCode: row.level_code, aisleCode: row.aisle_code };
}
