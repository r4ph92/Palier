import type { OnlineLot } from './OnlineLot.ts';

export interface LotAvailabilityRepository {
  findOnlineLots(): Promise<readonly OnlineLot[]>;
}
