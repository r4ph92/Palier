import type { LotAvailability } from '../occupancy/LotAvailability.ts';

export interface LotAvailabilityRepository {
  findOnlineLots(): Promise<readonly LotAvailability[]>;
}
