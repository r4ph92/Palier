import type { GeoPosition } from '@palier/shared-types';
import type { LotAvailability } from '../occupancy/LotAvailability.ts';

export interface OnlineLot {
  readonly id: string;
  readonly name: string;
  readonly location: GeoPosition | null;
  readonly availability: LotAvailability;
}
