import Stripe from 'stripe';
import type { OperatorStripeDependencies } from './http/buildServer.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresOperatorStripeAccounts } from './infrastructure/postgres/PostgresOperatorStripeAccounts.ts';
import { StripeAccountWebhookReader } from './infrastructure/stripe/StripeAccountWebhookReader.ts';
import { StripeOperatorGateway } from './infrastructure/stripe/StripeOperatorGateway.ts';

export interface OperatorStripeComposition {
  readonly database: Database;
  readonly stripeKey: string | null;
  readonly webhookSecret: string | null;
  readonly dashboardUrl: string | null;
}

// Each part needs its own settings: onboarding needs the key and the dashboard address, the webhook needs the key and its signing secret.
export function composeOperatorStripe({ database, stripeKey, webhookSecret, dashboardUrl }: OperatorStripeComposition): OperatorStripeDependencies {
  const stripe = stripeKey === null ? null : new Stripe(stripeKey);
  return {
    accounts: new PostgresOperatorStripeAccounts(database),
    gateway: stripe === null || dashboardUrl === null ? null : new StripeOperatorGateway(stripe, { returnUrl: `${dashboardUrl}/?stripe=return`, refreshUrl: `${dashboardUrl}/?stripe=refresh` }),
    webhookReader: stripe === null || webhookSecret === null ? null : new StripeAccountWebhookReader(stripe, webhookSecret),
  };
}
