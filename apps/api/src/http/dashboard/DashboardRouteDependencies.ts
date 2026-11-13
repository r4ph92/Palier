import type { LotSetupRepository } from '../../domain/dashboard/LotSetupRepository.ts';
import type { OperatorRepository } from '../../domain/dashboard/OperatorRepository.ts';
import type { OperatorStripeAccounts, OperatorStripeGateway } from '../../domain/dashboard/OperatorStripe.ts';
import type { SessionAccess } from '../../domain/sessions/sessionTokens.ts';

export interface DashboardStripeDependencies {
  readonly accounts: OperatorStripeAccounts;
  readonly gateway: OperatorStripeGateway;
}

export interface DashboardRouteDependencies {
  // Null without a Stripe key: an operator is still found, then told Stripe is unavailable.
  readonly stripe: DashboardStripeDependencies | null;
  readonly access: SessionAccess;
  readonly operators: OperatorRepository;
  readonly lots: LotSetupRepository;
  readonly testSignInEnabled: boolean;
  readonly secureCookies: boolean;
}
