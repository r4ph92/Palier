import type { DashboardErrorCode, DashboardSpotToCheck } from '@palier/shared-types';
import type { SpotPlace } from './LotSpotRepository.ts';

export type SpotCheckRefusal = Extract<DashboardErrorCode, 'LOT_NOT_FOUND' | 'LOT_BUSY' | 'SPOT_NOT_FOUND' | 'SPOT_STILL_ASSIGNED'>;

// Every statement names the operator; a clear first locks the operator's lot, so another operator's lot is LOT_NOT_FOUND before anything else is read.
export interface SpotCheckRepository {
  // The live spots flagged for a physical check, oldest flag first; null when the lot is not the operator's.
  listSpotsToCheck(operatorId: string, lotId: string): Promise<readonly DashboardSpotToCheck[] | null>;
  // Clears the flag of a free spot nothing holds. A spot already cleared stays cleared and answers 'CLEARED' too, so a double click is harmless.
  clearSpotCheck(operatorId: string, spot: SpotPlace): Promise<'CLEARED' | SpotCheckRefusal>;
}
