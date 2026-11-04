import type { ServerDependencies } from '../../../src/http/buildServer.ts';
import type { GateRouteDependencies } from '../../../src/http/routes/gateRoutes.ts';
import { FakeDriverRepository } from '../fakeDriverRepository.ts';
import { FakeVehicleRepository } from '../fakeVehicleRepository.ts';
import { FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger } from './gateFixtures.ts';

export const NOW = new Date('2026-10-27T22:02:00Z');

export function fakeGateDependencies(): GateRouteDependencies {
  return { deviceKeys: new FakeGateDeviceKeyRepository(), ledger: new FakePassageLedger(), clock: () => NOW, commands: new FakeGateCommandFeed() };
}

export function serverDependencies(overrides: Partial<ServerDependencies> = {}): ServerDependencies {
  return {
    repositories: {
      lotAvailabilityRepository: { findOnlineLots: () => Promise.resolve([]) },
      driverRepository: new FakeDriverRepository(),
      vehicleRepository: new FakeVehicleRepository(),
    },
    gates: fakeGateDependencies(),
    ...overrides,
  };
}
