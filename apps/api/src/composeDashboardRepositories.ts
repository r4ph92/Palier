import type { ServerDependencies } from './http/buildServer.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresExitIdentificationReader } from './infrastructure/postgres/PostgresExitIdentificationReader.ts';
import { PostgresGateSecretRepository } from './infrastructure/postgres/PostgresGateSecretRepository.ts';
import { PostgresLevelOccupancyReader } from './infrastructure/postgres/PostgresLevelOccupancyReader.ts';
import { PostgresLotEquipmentReader } from './infrastructure/postgres/PostgresLotEquipmentReader.ts';
import { PostgresLotGateRepository } from './infrastructure/postgres/PostgresLotGateRepository.ts';
import { PostgresLotMapRepository } from './infrastructure/postgres/PostgresLotMapRepository.ts';
import { PostgresLotPublicationRepository } from './infrastructure/postgres/PostgresLotPublicationRepository.ts';
import { PostgresLotSetupRepository } from './infrastructure/postgres/PostgresLotSetupRepository.ts';
import { PostgresLotSpotRepository } from './infrastructure/postgres/PostgresLotSpotRepository.ts';
import { PostgresOperatorRepository } from './infrastructure/postgres/PostgresOperatorRepository.ts';
import { PostgresSessionTimelineRepository } from './infrastructure/postgres/PostgresSessionTimelineRepository.ts';
import { PostgresSpotCheckRepository } from './infrastructure/postgres/PostgresSpotCheckRepository.ts';
import { PostgresStaleSessionReviewRepository } from './infrastructure/postgres/PostgresStaleSessionReviewRepository.ts';

type DashboardRepositories = Pick<
  ServerDependencies['repositories'],
  | 'operatorRepository'
  | 'lotSetupRepository'
  | 'levelOccupancy'
  | 'lotMaps'
  | 'lotEquipment'
  | 'lotSpots'
  | 'spotChecks'
  | 'sessionTimelines'
  | 'staleSessionReviews'
  | 'exitIdentifications'
  | 'lotGates'
  | 'gateSecrets'
  | 'lotPublication'
>;

export function composeDashboardRepositories(database: Database): DashboardRepositories {
  return {
    operatorRepository: new PostgresOperatorRepository(database),
    lotSetupRepository: new PostgresLotSetupRepository(database),
    levelOccupancy: new PostgresLevelOccupancyReader(database),
    lotMaps: new PostgresLotMapRepository(database),
    lotEquipment: new PostgresLotEquipmentReader(database),
    lotSpots: new PostgresLotSpotRepository(database),
    spotChecks: new PostgresSpotCheckRepository(database),
    sessionTimelines: new PostgresSessionTimelineRepository(database),
    staleSessionReviews: new PostgresStaleSessionReviewRepository(database),
    exitIdentifications: new PostgresExitIdentificationReader(database),
    lotGates: new PostgresLotGateRepository(database),
    gateSecrets: new PostgresGateSecretRepository(database),
    lotPublication: new PostgresLotPublicationRepository(database),
  };
}
