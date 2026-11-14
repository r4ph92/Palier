import type { LevelOccupancyReader } from '../../domain/dashboard/LevelOccupancyReader.ts';
import type { LotEquipmentReader } from '../../domain/dashboard/LotEquipmentReader.ts';
import type { LotMapRepository } from '../../domain/dashboard/LotMapRepository.ts';
import type { LotSetupRepository } from '../../domain/dashboard/LotSetupRepository.ts';
import type { OperatorRepository } from '../../domain/dashboard/OperatorRepository.ts';
import type { OperatorStripeAccounts, OperatorStripeGateway } from '../../domain/dashboard/OperatorStripe.ts';
import type { SessionAccess } from '../../domain/sessions/sessionTokens.ts';
import type { Clock } from '../../domain/time/Clock.ts';

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
  readonly occupancy: LevelOccupancyReader;
  readonly maps: LotMapRepository;
  readonly equipment: LotEquipmentReader;
  // The test clock when it is active, so moving it makes a gate silent or a battery reading old.
  readonly clock: Clock;
  readonly testSignInEnabled: boolean;
  readonly secureCookies: boolean;
}
