import type { OnlineLot } from './OnlineLot.ts';

export interface LotAvailabilityRepository {
  findOnlineLots(limit: number): Promise<readonly OnlineLot[]>;
}
