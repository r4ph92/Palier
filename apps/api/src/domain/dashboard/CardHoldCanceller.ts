// The one card operation a staff closing may run: it cancels the hold taken at entry and can never capture (decisions 023 and 043).
// PaymentAuthorizer satisfies it; Stripe answers 'gone' for a hold it can no longer cancel and 'failed' when it cannot be reached.
export interface CardHoldCanceller {
  cancel(paymentIntentId: string): Promise<'released' | 'gone' | 'failed'>;
}
