// D1: each started increment costs incrementCents, and a day never costs more than dailyCapCents.
export interface PricingPolicy {
  readonly incrementCents: number;
  readonly incrementMinutes: number;
  readonly dailyCapCents: number;
}

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
