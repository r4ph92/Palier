import type { DashboardLotDetails } from '@palier/shared-types';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { lotDraftErrors, type LotDraft } from '@palier/shared-types/lotDraft';
import { pricingErrors, type LotPricingSettings, type LotPricingRequest } from '@palier/shared-types/lotPricing';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { LotSetupRepository } from './LotSetupRepository.ts';
import type { OperatorRepository } from './OperatorRepository.ts';

export interface LotSetupSources {
  readonly operators: Pick<OperatorRepository, 'findOperatorOfMember'>;
  readonly lots: LotSetupRepository;
}

export interface PricingChange {
  readonly userId: string;
  readonly lotId: string;
  readonly pricing: LotPricingRequest;
}

export async function createLotOfMember({ operators, lots }: LotSetupSources, userId: string, draft: LotDraft): Promise<DashboardLotDetails> {
  const operator = await operators.findOperatorOfMember(userId);
  if (operator === null) {
    throw new DashboardRefusedError('NO_OPERATOR');
  }
  const trimmedDraft = { ...draft, name: draft.name.trim(), address: draft.address.trim() };
  const refusal = firstFieldError(lotDraftErrors(trimmedDraft));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return lots.createLot(operator.id, trimmedDraft);
}

// The rule runs before any read, so a refused body says nothing about whether the lot exists.
export async function setLotPricingOfMember({ operators, lots }: LotSetupSources, { userId, lotId, pricing }: PricingChange): Promise<DashboardLotDetails> {
  const validPricing = validatedPricing(pricing);
  const operator = await operators.findOperatorOfMember(userId);
  const updated = operator === null ? null : await lots.updateLotPricing(operator.id, lotId, validPricing);
  if (updated === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  return updated;
}

// Another operator's lot and a lot that does not exist give the same answer, so ids reveal nothing.
export async function findLotDetailsOfMember({ operators, lots }: LotSetupSources, userId: string, lotId: string): Promise<DashboardLotDetails> {
  const operator = await operators.findOperatorOfMember(userId);
  const lot = operator === null ? null : await lots.findLotDetailsOfOperator(operator.id, lotId);
  if (lot === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  return lot;
}

function validatedPricing(pricing: LotPricingRequest): LotPricingSettings {
  const { dailyCapCents } = pricing;
  const refusal = firstFieldError(pricingErrors(pricing));
  if (refusal !== null || dailyCapCents === null) {
    throw new DashboardRefusedError(refusal ?? 'PRICING_DAILY_CAP_REQUIRED');
  }
  return { ...pricing, dailyCapCents };
}
