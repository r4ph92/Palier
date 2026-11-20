import { sql } from 'drizzle-orm';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';

// The needs written on the session at entry, joined as `ps`: a change to the vehicle, or its deletion, during the session never changes them (story #219).
export const sessionNeedsColumns = sql`ps.is_electric, ps.has_accessible_permit, ps.is_oversize`;

export interface VehicleNeedsRow {
  readonly is_electric: boolean;
  readonly has_accessible_permit: boolean;
  readonly is_oversize: boolean;
}

export function vehicleNeedsOf(row: VehicleNeedsRow): VehicleNeeds {
  return { isElectric: row.is_electric, hasAccessiblePermit: row.has_accessible_permit, isOversize: row.is_oversize };
}
