import type { EntryPolicy } from '../entries/EntryEligibility.ts';

// In demo mode a lot whose operator has no Stripe account still takes payments, held on the platform.
export function isOperatorPayable(operatorStripeAccountId: string | null, policy: EntryPolicy): boolean {
  return operatorStripeAccountId !== null || policy.allowPlatformChargesWithoutOperatorAccount;
}
