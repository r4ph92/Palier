import type { TariffPolicy } from '@palier/shared-types/lotPricing';

// The one D1 tariff, shared with the dashboard form.
export type PricingPolicy = TariffPolicy;

export class PricingPolicyInvalidError extends Error {
  readonly lotId: string | undefined;

  constructor(lotId?: string, options?: ErrorOptions) {
    super(lotId === undefined ? 'The lot has no usable pricing policy.' : `Lot ${lotId} has no usable pricing policy.`, options);
    this.lotId = lotId;
    this.name = 'PricingPolicyInvalidError';
  }
}

// The lot stores increment and length in an untyped jsonb column and the cap in its own column, null on a lot without pricing.
export function parsePricingPolicy(storedPolicy: unknown, dailyCapCents: number | null): PricingPolicy {
  if (typeof storedPolicy !== 'object' || storedPolicy === null) {
    throw new PricingPolicyInvalidError();
  }
  const { incrementCents, incrementMinutes } = storedPolicy as Record<string, unknown>;
  if (!isPositiveInteger(incrementCents) || !isPositiveInteger(incrementMinutes) || !isPositiveInteger(dailyCapCents)) {
    throw new PricingPolicyInvalidError();
  }
  return { incrementCents, incrementMinutes, dailyCapCents };
}

export type StoredPricingPolicy = Omit<TariffPolicy, 'dailyCapCents'>;

// What the lot's jsonb column holds, the one shape parsePricingPolicy reads back.
export function storedPricingPolicyOf({ incrementCents, incrementMinutes }: StoredPricingPolicy): StoredPricingPolicy {
  return { incrementCents, incrementMinutes };
}

export interface PricedLot {
  readonly id: string;
  // The lot's jsonb policy as stored.
  readonly pricingPolicy: unknown;
  readonly dailyCapCents: number | null;
}

// The problem is returned, not thrown, so each caller turns it into its own refusal and keeps it as the cause to log.
export function readLotPricing(lot: PricedLot): PricingPolicy | PricingPolicyInvalidError {
  try {
    return parsePricingPolicy(lot.pricingPolicy, lot.dailyCapCents);
  } catch (error) {
    if (!(error instanceof PricingPolicyInvalidError)) {
      throw error;
    }
    return new PricingPolicyInvalidError(lot.id, { cause: error });
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
