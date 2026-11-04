import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { FakeCardGateway } from './fakeCardGateway.ts';
import { FakeDriverRepository } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { fakeEntries } from './fakes/entryFakes.ts';
import { fakeGateDependencies } from './fakes/serverDependencies.ts';

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
  const server: FastifyInstance = buildServer({
    gates: fakeGateDependencies(),
    repositories: { lotAvailabilityRepository: noLots, driverRepository, vehicleRepository },
    cardGateway: new FakeCardGateway(),
    entries: entries.dependencies,
    settings: { testSignInEnabled, demoMode, minimumAppVersion },
  });
  return { server, driverRepository, vehicleRepository, entries };
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
