import { sql } from 'drizzle-orm';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';

// The session's vehicle, joined as `vehicle`; a session whose vehicle was deleted keeps standard needs.
export const vehicleNeedsColumns = sql`coalesce(vehicle.is_electric, false) as is_electric,
      coalesce(vehicle.has_accessible_permit, false) as has_accessible_permit, coalesce(vehicle.is_oversize, false) as is_oversize`;

export interface VehicleNeedsRow {
  readonly is_electric: boolean;
  readonly has_accessible_permit: boolean;
  readonly is_oversize: boolean;
}

export function vehicleNeedsOf(row: VehicleNeedsRow): VehicleNeeds {
  return { isElectric: row.is_electric, hasAccessiblePermit: row.has_accessible_permit, isOversize: row.is_oversize };
}
