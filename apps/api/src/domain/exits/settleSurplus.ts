import type { PaymentAuthorizer, SurplusRequest } from '../entries/PaymentAuthorizer.ts';
import type { PaidExit } from './ExitRepository.ts';

export type SurplusSettlement = Pick<PaidExit, 'surplusPaidCents' | 'unpaidCents'>;

// A stay over 24 hours costs more than the hold: the rest is charged to the card (decision 027). A refusal is an unpaid balance; null
// when Stripe could not say whether the card was charged, so the exit stays pending and the retry asks again.
export async function settleSurplus(payments: PaymentAuthorizer, surplus: SurplusRequest): Promise<SurplusSettlement | null> {
  if (surplus.amountCents === 0) {
    return { surplusPaidCents: 0, unpaidCents: 0 };
  }
  const charged = await payments.chargeSurplus(surplus);
  if (charged.outcome === 'failed') {
    return null;
  }
  return charged.outcome === 'charged' ? { surplusPaidCents: charged.amountCents, unpaidCents: 0 } : { surplusPaidCents: 0, unpaidCents: surplus.amountCents };
}
