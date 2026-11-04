import type { FastifyInstance } from 'fastify';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { FakeCardGateway } from './fakeCardGateway.ts';
import { FakeDriverRepository } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';
import { fakeOperatorStripe } from './fakes/fakeOperatorStripe.ts';
import { FakeCurrentParkingSessions } from './fakes/fakeCurrentParkingSessions.ts';
import { fakeEntries } from './fakes/entryFakes.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };

interface ServerOptions {
  readonly testSignInEnabled?: boolean;
  readonly demoMode?: boolean;
  readonly minimumAppVersion?: string;
}

// The one place route tests build the real server over fake repositories.
export function configureServer({ testSignInEnabled = false, demoMode = false, minimumAppVersion }: ServerOptions = {}) {
  const driverRepository = new FakeDriverRepository();
  const vehicleRepository = new FakeVehicleRepository();
  const entries = fakeEntries({ drivers: driverRepository, vehicles: vehicleRepository });
  const parkingSessions = new FakeCurrentParkingSessions();
  const testClock = createTestClock();
  const operatorRepository = new FakeOperatorRepository();
  const server: FastifyInstance = buildServer({
    gates: fakeGateDependencies(),
    repositories: fakeRepositories({ lotAvailabilityRepository: noLots, driverRepository, vehicleRepository, operatorRepository, parkingSessions }),
    operatorStripe: fakeOperatorStripe(operatorRepository).dependencies,
    cardGateway: new FakeCardGateway(),
    entries: entries.dependencies,
    testClock,
    settings: { testSignInEnabled, demoMode, minimumAppVersion },
  });
  return { server, driverRepository, vehicleRepository, entries, parkingSessions, testClock };
}

// Every route the server registers, as "METHOD /path" with the :params kept, read from Fastify's route tree.
export async function registeredRoutes(server: FastifyInstance): Promise<string[]> {
  await server.ready();
  const segments: string[] = [];
  const routes: string[] = [];
  for (const line of server.printRoutes({ commonPrefix: false }).split('\n')) {
    const column = line.search(/[^│├└─ ]/);
    if (column === -1) {
      continue;
    }
    const depth = column / 4;
    segments.length = depth;
    segments[depth] = line.slice(column, line.indexOf(' ('));
    const methods = line.slice(line.indexOf(' (') + 2, -1).split(', ');
    for (const method of methods.filter((name) => name !== 'HEAD')) {
      routes.push(`${method} ${segments.join('')}`);
    }
  }
  return routes;
}
