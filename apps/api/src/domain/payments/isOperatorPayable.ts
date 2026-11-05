import type { EntryPolicy } from './EntryPolicy.ts';

export function isOperatorPayable(operatorStripeAccountId: string | null, policy: EntryPolicy): boolean {
  return operatorStripeAccountId !== null || policy.allowPlatformChargesWithoutOperatorAccount;
}
