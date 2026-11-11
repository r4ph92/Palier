import type { DashboardLotDetails } from '@palier/shared-types';
import type { LotPricing } from '@palier/shared-types/lotPricing';
import { parsePricingPolicy } from '../../domain/pricing/PricingPolicy.ts';

// Postgres answers numeric columns as text, so the coordinates arrive as strings.
export interface LotDetailsRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly is_online: boolean;
  readonly address: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly capacity: number;
  readonly beacon_major: number | null;
  readonly pricing_policy: unknown;
  readonly daily_cap_cents: number | null;
  readonly hold_quota: number;
}

export function lotDetailsOf(row: LotDetailsRow): DashboardLotDetails {
  return {
    id: row.id,
    name: row.name,
    isOnline: row.is_online,
    address: row.address,
    latitude: degreesOf(row.latitude),
    longitude: degreesOf(row.longitude),
    capacity: row.capacity,
    beaconMajor: row.beacon_major,
    pricing: pricingOf(row),
  };
}

function degreesOf(column: string | null): number | null {
  return column === null ? null : Number(column);
}

// The completeness check keeps policy and cap null together: a lot without them has no pricing yet.
function pricingOf(row: LotDetailsRow): LotPricing | null {
  if (row.daily_cap_cents === null) {
    return null;
  }
  return { ...parsePricingPolicy(row.pricing_policy, row.daily_cap_cents), holdQuota: row.hold_quota };
}
