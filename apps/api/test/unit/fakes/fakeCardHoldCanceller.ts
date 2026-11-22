import type { CardHoldCanceller } from '../../../src/domain/dashboard/CardHoldCanceller.ts';

// Records every hold it was asked to cancel; Stripe's answer, or its failure, is scripted.
export class FakeCardHoldCanceller implements CardHoldCanceller {
  readonly cancelled: string[] = [];
  answer: 'released' | 'gone' | 'failed' = 'released';
  failure: Error | null = null;

  cancel(paymentIntentId: string): Promise<'released' | 'gone' | 'failed'> {
    this.cancelled.push(paymentIntentId);
    return this.failure === null ? Promise.resolve(this.answer) : Promise.reject(this.failure);
  }
}
