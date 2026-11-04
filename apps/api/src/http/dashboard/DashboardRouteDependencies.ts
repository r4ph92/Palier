import type { OperatorRepository } from '../../domain/dashboard/OperatorRepository.ts';
import type { SessionAccess } from '../../domain/sessions/sessionTokens.ts';

export interface DashboardRouteDependencies {
  readonly access: SessionAccess;
  readonly operators: OperatorRepository;
  readonly testSignInEnabled: boolean;
  // Off only in development, where the dashboard is served over plain http.
  readonly secureCookies: boolean;
}
