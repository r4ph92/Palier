import type { LotAvailabilityRepository } from '../../../src/domain/lots/LotAvailabilityRepository.ts';
import type { VehicleRepository } from '../../../src/domain/vehicles/VehicleRepository.ts';
import type { ServerDependencies } from '../../../src/http/buildServer.ts';
import type { GateRouteDependencies } from '../../../src/http/routes/gateRoutes.ts';
import { FakeDriverRepository } from '../fakeDriverRepository.ts';
import { FakeVehicleRepository } from '../fakeVehicleRepository.ts';
import { FakeCurrentParkingSessions } from './fakeCurrentParkingSessions.ts';
import { FakeOperatorRepository } from './fakeOperatorRepository.ts';
import { FakeParkedPresumptions } from './fakeParkedPresumptions.ts';
import { FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger } from './gateFixtures.ts';

export const NOW = new Date('2026-10-27T22:02:00Z');
export const SIXTY_SECOND_WINDOW = { withinMilliseconds: 60_000 };

export function fakeGateDependencies(): GateRouteDependencies {
  return { deviceKeys: new FakeGateDeviceKeyRepository(), ledger: new FakePassageLedger(), clock: () => NOW, commands: new FakeGateCommandFeed(), openingWindow: SIXTY_SECOND_WINDOW };
}

interface FakeRepositoryChoices {
  readonly driverRepository?: FakeDriverRepository;
  readonly vehicleRepository?: VehicleRepository;
  readonly lotAvailabilityRepository?: LotAvailabilityRepository;
  readonly operatorRepository?: FakeOperatorRepository;
  readonly parkingSessions?: FakeCurrentParkingSessions;
  readonly parkedPresumptions?: FakeParkedPresumptions;
}

// Session tokens come from the driver fake, so a token a test saves for Julie is the one the server reads.
export function fakeRepositories({
  driverRepository = new FakeDriverRepository(),
  vehicleRepository = new FakeVehicleRepository(),
  lotAvailabilityRepository = { findOnlineLots: () => Promise.resolve([]) },
  operatorRepository = new FakeOperatorRepository(),
  parkingSessions = new FakeCurrentParkingSessions(),
  parkedPresumptions = new FakeParkedPresumptions(),
}: FakeRepositoryChoices = {}): ServerDependencies['repositories'] {
  return {
    lotAvailabilityRepository,
    driverRepository,
    sessionTokenRepository: driverRepository.sessions,
    userDirectory: driverRepository,
    vehicleRepository,
    operatorRepository,
    currentParkingSessions: parkingSessions,
    parkingSessionBackdater: parkingSessions,
    parkedPresumptions,
  };
}

export function serverDependencies(overrides: Partial<ServerDependencies> = {}): ServerDependencies {
  return { repositories: fakeRepositories(), gates: fakeGateDependencies(), ...overrides };
}
