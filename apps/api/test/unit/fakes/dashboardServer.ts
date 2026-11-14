import { composeClock } from '../../../src/composeClock.ts';
import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import type { FastifyInstance } from 'fastify';
import type { Driver } from '../../../src/domain/drivers/Driver.ts';
import { buildServer, type ServerSettings } from '../../../src/http/buildServer.ts';
import { FakeDriverRepository, julie, marc } from '../fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './dashboardFixtures.ts';
import { fakeOperatorStripe } from './fakeOperatorStripe.ts';
import { FakeLotEquipmentReader } from './fakeLotEquipmentReader.ts';
import { FakeLotMapRepository } from './fakeLotMapRepository.ts';
import { FakeLotSpotRepository } from './fakeLotSpotRepository.ts';
import { FakeSpotCheckRepository } from './fakeSpotCheckRepository.ts';
import { FakeOperatorRepository } from './fakeOperatorRepository.ts';
import { fakeGateDependencies, fakeRepositories } from './serverDependencies.ts';

export const DASHBOARD_COOKIE = 'palier_dashboard';
export const writeHeader = { [DASHBOARD_CSRF_HEADER]: DASHBOARD_CSRF_VALUE };

export function startDashboardServer(settings: ServerSettings = { testSignInEnabled: true }) {
  const driverRepository = new FakeDriverRepository([julie, marc, sophie, pierre, nouvelOperateur]);
  const operatorRepository = new FakeOperatorRepository();
  const stripe = fakeOperatorStripe(operatorRepository);
  const lotMaps = new FakeLotMapRepository(operatorRepository.lots);
  const lotEquipment = new FakeLotEquipmentReader(operatorRepository.lots);
  const lotSpots = new FakeLotSpotRepository(operatorRepository.lots, lotMaps);
  const spotChecks = new FakeSpotCheckRepository(operatorRepository.lots, lotMaps, lotSpots);
  const { testClock } = composeClock(settings.testSignInEnabled === true);
  const server: FastifyInstance = buildServer({
    gates: fakeGateDependencies(),
    repositories: { ...fakeRepositories({ driverRepository, operatorRepository }), lotMaps, lotEquipment, lotSpots, spotChecks },
    operatorStripe: stripe.dependencies,
    testClock,
    settings,
  });
  return { server, driverRepository, lots: operatorRepository.lots, lotMaps, lotEquipment, lotSpots, spotChecks, testClock, ...stripe };
}

// Signs in through the test route and returns the cookie the browser would send back.
export async function dashboardCookieFor(server: FastifyInstance, user: Driver): Promise<Record<string, string>> {
  const response = await server.inject({ method: 'POST', url: '/v1/dashboard/test/sign-in', headers: writeHeader, payload: { userId: user.id } });
  const cookie = response.cookies.find(({ name }) => name === DASHBOARD_COOKIE);
  if (cookie === undefined) {
    throw new Error(`no dashboard cookie for ${user.firstName}: ${response.statusCode} ${response.body}`);
  }
  return { [DASHBOARD_COOKIE]: cookie.value };
}
