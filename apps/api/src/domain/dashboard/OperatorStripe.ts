import type { KycStatus } from '@palier/shared-types';

// What Stripe says about a connected account, reduced to what decides the status shown on the dashboard.
export interface AccountSnapshot {
  readonly accountId: string;
  readonly detailsSubmitted: boolean;
  readonly chargesEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly currentlyDue: readonly string[];
  readonly pastDue: readonly string[];
}

// Stripe's own error text stays in the log; the dashboard only gets STRIPE_UNAVAILABLE.
export class OperatorStripeUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Stripe is unavailable right now.', options);
    this.name = 'OperatorStripeUnavailableError';
  }
}

// The part of Stripe the operator onboarding uses: Express accounts and their hosted onboarding link.
export interface OperatorStripeGateway {
  // The operator id is the idempotency key, so a retry or a double click never creates a second account.
  createExpressAccount(operatorId: string, legalName: string): Promise<string>;
  createOnboardingLink(accountId: string): Promise<string>;
}

export class InvalidWebhookSignatureError extends Error {
  constructor(options?: ErrorOptions) {
    super('The Stripe signature is missing or does not match.', options);
    this.name = 'InvalidWebhookSignatureError';
  }
}

// Checks the signature of a Stripe notification on its raw body; null when the event is not an account update.
export interface AccountWebhookReader {
  read(rawBody: Buffer, signature: string | undefined): AccountSnapshot | null;
}

export interface OperatorStripeAccounts {
  findAccountId(operatorId: string): Promise<string | null>;
  // Stores the account as PENDING when the operator has none, and answers the id now stored: the one that won a concurrent request.
  saveAccountIfAbsent(operatorId: string, accountId: string): Promise<string>;
  // False when no operator has this account.
  updateStatusOfAccount(accountId: string, status: KycStatus): Promise<boolean>;
}

// Verified needs payments and payouts on and nothing due; information still due after submitting asks the operator to act.
export function kycStatusOf({ detailsSubmitted, chargesEnabled, payoutsEnabled, currentlyDue, pastDue }: AccountSnapshot): KycStatus {
  const informationDue = currentlyDue.length > 0 || pastDue.length > 0;
  if (chargesEnabled && payoutsEnabled && !informationDue) {
    return 'VERIFIED';
  }
  return detailsSubmitted && informationDue ? 'ACTION_REQUIRED' : 'PENDING';
}
