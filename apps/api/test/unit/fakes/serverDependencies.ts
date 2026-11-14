import type { LotAvailabilityRepository } from '../../../src/domain/lots/LotAvailabilityRepository.ts';
import type { VehicleRepository } from '../../../src/domain/vehicles/VehicleRepository.ts';
import type { ServerDependencies } from '../../../src/http/buildServer.ts';
import type { GateRouteDependencies } from '../../../src/http/routes/gateRoutes.ts';
import { FakeDriverRepository } from '../fakeDriverRepository.ts';
import { FakeVehicleRepository } from '../fakeVehicleRepository.ts';
import { FakeCurrentParkingSessions } from './fakeCurrentParkingSessions.ts';
import { FakeLevelOccupancyReader } from './fakeLevelOccupancyReader.ts';
import { FakeLotEquipmentReader } from './fakeLotEquipmentReader.ts';
import { FakeLotMapRepository } from './fakeLotMapRepository.ts';
import { FakeLotSetupRepository } from './fakeLotSetupRepository.ts';
import { FakeSpotCheckRepository } from './fakeSpotCheckRepository.ts';
import { FakeLotSpotRepository } from './fakeLotSpotRepository.ts';
import { FakeOperatorRepository } from './fakeOperatorRepository.ts';
import { FakeParkedAnswers } from './fakeParkedAnswers.ts';
import { FakeParkedPresumptions } from './fakeParkedPresumptions.ts';
import { FakeReceipts } from './fakeReceipts.ts';
import { FakeSpotTakenReports } from './fakeSpotTakenReports.ts';
import { FakeEquipmentReports, FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger } from './gateFixtures.ts';

export const NOW = new Date('2026-10-27T22:02:00Z');
export const SIXTY_SECOND_WINDOW = { withinMilliseconds: 60_000 };

export function fakeGateDependencies(): GateRouteDependencies {
  return {
    deviceKeys: new FakeGateDeviceKeyRepository(),
    ledger: new FakePassageLedger(),
    passageClock: () => NOW,
    commands: new FakeGateCommandFeed(),
    openingWindow: SIXTY_SECOND_WINDOW,
    equipment: new FakeEquipmentReports(),
  };
}

interface FakeRepositoryChoices {
  readonly driverRepository?: FakeDriverRepository;
  readonly vehicleRepository?: VehicleRepository;
  readonly lotAvailabilityRepository?: LotAvailabilityRepository;
  readonly operatorRepository?: FakeOperatorRepository;
  readonly parkingSessions?: FakeCurrentParkingSessions;
  readonly parkedPresumptions?: FakeParkedPresumptions;
  readonly parkedAnswers?: FakeParkedAnswers;
  readonly spotTakenReports?: FakeSpotTakenReports;
}

// Session tokens come from the driver fake, so a token a test saves for Julie is the one the server reads.
export function fakeRepositories({
  driverRepository = new FakeDriverRepository(),
  vehicleRepository = new FakeVehicleRepository(),
  lotAvailabilityRepository = { findOnlineLots: () => Promise.resolve([]) },
  operatorRepository = new FakeOperatorRepository(),
  parkingSessions = new FakeCurrentParkingSessions(),
  parkedPresumptions = new FakeParkedPresumptions(),
  parkedAnswers = new FakeParkedAnswers(),
  spotTakenReports = new FakeSpotTakenReports(),
}: FakeRepositoryChoices = {}): ServerDependencies['repositories'] {
  const lotMaps = new FakeLotMapRepository(operatorRepository.lots);
  const lotSpots = new FakeLotSpotRepository(operatorRepository.lots, lotMaps);
  return {
    lotAvailabilityRepository,
    driverRepository,
    sessionTokenRepository: driverRepository.sessions,
    userDirectory: driverRepository,
    vehicleRepository,
    operatorRepository,
    lotSetupRepository: new FakeLotSetupRepository(operatorRepository.lots),
    levelOccupancy: new FakeLevelOccupancyReader(operatorRepository.lots),
    lotMaps,
    lotEquipment: new FakeLotEquipmentReader(operatorRepository.lots),
    lotSpots,
    spotChecks: new FakeSpotCheckRepository(operatorRepository.lots, lotMaps, lotSpots),
    currentParkingSessions: parkingSessions,
    parkingSessionBackdater: parkingSessions,
    parkedPresumptions,
    parkedAnswers,
    spotTakenReports,
    receipts: new FakeReceipts(),
  };
}

export function serverDependencies(overrides: Partial<ServerDependencies> = {}): ServerDependencies {
  return { repositories: fakeRepositories(), gates: fakeGateDependencies(), ...overrides };
}
