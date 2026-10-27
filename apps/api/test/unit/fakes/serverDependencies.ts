import type { ServerDependencies } from '../../../src/http/buildServer.ts';
import { FakeGateDeviceKeyRepository, FakePassageLedger } from './gateFixtures.ts';

export const NOW = new Date('2026-10-27T22:02:00Z');

export function serverDependencies(overrides: Partial<ServerDependencies> = {}): ServerDependencies {
  return {
    lotAvailabilityRepository: { findOnlineLots: () => Promise.resolve([]) },
    gates: { deviceKeys: new FakeGateDeviceKeyRepository(), ledger: new FakePassageLedger(), clock: () => NOW },
    ...overrides,
  };
}
