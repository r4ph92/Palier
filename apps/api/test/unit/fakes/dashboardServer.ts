import { composeClock } from '../../../src/composeClock.ts';
import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import type { FastifyInstance } from 'fastify';
import type { Driver } from '../../../src/domain/drivers/Driver.ts';
import type { GateRouteDependencies } from '../../../src/http/routes/gateRoutes.ts';
import { buildServer, type ServerDependencies, type ServerSettings } from '../../../src/http/buildServer.ts';
import { FakeDriverRepository, julie, marc } from '../fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './dashboardFixtures.ts';
import { fakeOperatorStripe } from './fakeOperatorStripe.ts';
import { FakeLotEquipmentReader } from './fakeLotEquipmentReader.ts';
import { FakeLotGateRepository } from './fakeLotGateRepository.ts';
import { FakeLotMapRepository } from './fakeLotMapRepository.ts';
import { FakeLotPublicationRepository } from './fakeLotPublicationRepository.ts';
import { FakeLotSpotRepository } from './fakeLotSpotRepository.ts';
import { FakeSessionTimelineRepository } from './fakeSessionTimelineRepository.ts';
import { FakeCardHoldCanceller } from './fakeCardHoldCanceller.ts';
import { FakeStaleSessionReviewRepository } from './fakeStaleSessionReviewRepository.ts';
import { FakeSpotCheckRepository } from './fakeSpotCheckRepository.ts';
import { FakeOperatorRepository } from './fakeOperatorRepository.ts';
import { fakeGateDependencies, fakeRepositories } from './serverDependencies.ts';

export const DASHBOARD_COOKIE = 'palier_dashboard';
export const writeHeader = { [DASHBOARD_CSRF_HEADER]: DASHBOARD_CSRF_VALUE };

type RepositoryOverrides = Partial<ServerDependencies['repositories']>;

// overrides replaces a fake with a scripted Postgres repository, so a test sees what a real statement failure does.
export function startDashboardServer(settings: ServerSettings = { testSignInEnabled: true }, overrides: RepositoryOverrides = {}) {
  const driverRepository = new FakeDriverRepository([julie, marc, sophie, pierre, nouvelOperateur]);
  const operatorRepository = new FakeOperatorRepository();
  const stripe = fakeOperatorStripe(operatorRepository);
  const lotMaps = new FakeLotMapRepository(operatorRepository.lots);
  const lotEquipment = new FakeLotEquipmentReader(operatorRepository.lots);
  const lotSpots = new FakeLotSpotRepository(operatorRepository.lots, lotMaps);
  const spotChecks = new FakeSpotCheckRepository(operatorRepository.lots, lotMaps, lotSpots);
  const sessionTimelines = new FakeSessionTimelineRepository(operatorRepository.lots);
  const staleSessionReviews = new FakeStaleSessionReviewRepository(operatorRepository.lots);
  const lotGates = new FakeLotGateRepository(operatorRepository.lots);
  const lotPublication = new FakeLotPublicationRepository(operatorRepository.lots);
  const cardHolds = new FakeCardHoldCanceller();
  const { testClock } = composeClock(settings.testSignInEnabled === true);
  const server: FastifyInstance = buildServer({
    gates: gateDependenciesReading(lotGates),
    repositories: { ...fakeRepositories({ driverRepository, operatorRepository }), lotMaps, lotEquipment, lotSpots, spotChecks, sessionTimelines, staleSessionReviews, lotGates, gateSecrets: lotGates, lotPublication, ...overrides },
    operatorStripe: stripe.dependencies,
    cardHolds,
    testClock,
    settings,
  });
  return { server, driverRepository, lots: operatorRepository.lots, lotMaps, lotEquipment, lotSpots, spotChecks, sessionTimelines, staleSessionReviews, cardHolds, lotGates, lotPublication, testClock, ...stripe };
}

// A key the dashboard issued or rotated authenticates the gate routes; the seeded test keys still do too.
function gateDependenciesReading(lotGates: FakeLotGateRepository): GateRouteDependencies {
  const gates = fakeGateDependencies();
  const findByKeyHash = async (keyHash: string) => (await lotGates.findByKeyHash(keyHash)) ?? gates.deviceKeys.findByKeyHash(keyHash);
  return { ...gates, deviceKeys: { findByKeyHash } };
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
