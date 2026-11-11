import type { DashboardLotDetails } from '@palier/shared-types';
import type { LotDraft } from '@palier/shared-types/lotDraft';
import type { LotPricing } from '@palier/shared-types/lotPricing';

// Every statement names the operator, so a member only ever reads or changes a lot of their own operator.
export interface LotSetupRepository {
  // Offline, without pricing, with the next beacon major of the platform.
  createLot(operatorId: string, draft: LotDraft): Promise<DashboardLotDetails>;
  // Null when the operator has no lot with this id.
  updateLotPricing(operatorId: string, lotId: string, pricing: LotPricing): Promise<DashboardLotDetails | null>;
  findLotDetailsOfOperator(operatorId: string, lotId: string): Promise<DashboardLotDetails | null>;
}
