import type { OperatorRepository } from '../../domain/dashboard/OperatorRepository.ts';
import type { SessionAccess } from '../../domain/sessions/sessionTokens.ts';

export interface DashboardRouteDependencies {
  readonly access: SessionAccess;
  readonly operators: OperatorRepository;
  readonly testSignInEnabled: boolean;
  readonly secureCookies: boolean;
}
