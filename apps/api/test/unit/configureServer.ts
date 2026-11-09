import type { Clock } from '../../src/domain/time/Clock.ts';
import type { FastifyInstance } from 'fastify';
import { spotHoldServicesOf } from '../../src/composeSpotHolds.ts';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { FakeCardGateway } from './fakeCardGateway.ts';
import { FakeDriverRepository } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';
import { fakeOperatorStripe } from './fakes/fakeOperatorStripe.ts';
import { FakeCurrentParkingSessions } from './fakes/fakeCurrentParkingSessions.ts';
import { FakeExits } from './fakes/fakeExits.ts';
import { FakeParkedAnswers } from './fakes/fakeParkedAnswers.ts';
import { FakeParkedPresumptions } from './fakes/fakeParkedPresumptions.ts';
import { FakeReceipts } from './fakes/fakeReceipts.ts';
import { FakeSpotTakenReports } from './fakes/fakeSpotTakenReports.ts';
import { fakeEntries } from './fakes/entryFakes.ts';
import { STRICT_POLICY } from './fakes/entryGateFakes.ts';
import { FakeSpotHoldRepository } from './fakes/fakeSpotHolds.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };

interface ServerOptions {
  readonly testSignInEnabled?: boolean;
  readonly demoMode?: boolean;
  readonly minimumAppVersion?: string;
  readonly entryClock?: Clock;
}

// The one place route tests build the real server over fake repositories.
export function configureServer({ testSignInEnabled = false, demoMode = false, minimumAppVersion, entryClock }: ServerOptions = {}) {
  const driverRepository = new FakeDriverRepository();
  const vehicleRepository = new FakeVehicleRepository();
  const entries = fakeEntries({ drivers: driverRepository, vehicles: vehicleRepository, ...(entryClock === undefined ? {} : { clock: entryClock }) });
  const parkingSessions = new FakeCurrentParkingSessions();
  const parkedPresumptions = new FakeParkedPresumptions();
  const parkedAnswers = new FakeParkedAnswers();
  const spotTakenReports = new FakeSpotTakenReports();
  const exits = new FakeExits();
  const receipts = new FakeReceipts();
  const testClock = createTestClock();
  const operatorRepository = new FakeOperatorRepository();
  const spotHolds = new FakeSpotHoldRepository();
  const server: FastifyInstance = buildServer({
    gates: fakeGateDependencies(),
    repositories: { ...fakeRepositories({ lotAvailabilityRepository: noLots, driverRepository, vehicleRepository, operatorRepository, parkingSessions, parkedPresumptions, parkedAnswers, spotTakenReports }), receipts },
    operatorStripe: fakeOperatorStripe(operatorRepository).dependencies,
    cardGateway: new FakeCardGateway(),
    entries: entries.dependencies,
    exits: { exits, payments: entries.payments },
    spotHolds: spotHoldServicesOf(spotHolds, { vehicles: vehicleRepository, drivers: driverRepository }, STRICT_POLICY),
    testClock,
    settings: { testSignInEnabled, demoMode, minimumAppVersion },
  });
  return { server, driverRepository, vehicleRepository, entries, spotHolds, parkingSessions, parkedPresumptions, parkedAnswers, spotTakenReports, exits, receipts, testClock };
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
