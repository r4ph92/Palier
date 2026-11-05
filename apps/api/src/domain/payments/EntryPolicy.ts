export interface EntryPolicy {
  readonly allowPlatformChargesWithoutOperatorAccount: boolean;
}

// Demo mode lets a lot whose operator has no Stripe account take entries and holds anyway, charged on the platform.
export function entryPolicyFor(demoMode: boolean): EntryPolicy {
  return { allowPlatformChargesWithoutOperatorAccount: demoMode };
}
