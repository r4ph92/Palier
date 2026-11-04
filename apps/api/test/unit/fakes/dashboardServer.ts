import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import type { FastifyInstance } from 'fastify';
import type { Driver } from '../../../src/domain/drivers/Driver.ts';
import { buildServer, type ServerSettings } from '../../../src/http/buildServer.ts';
import { FakeDriverRepository, julie, marc } from '../fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './dashboardFixtures.ts';
import { fakeOperatorStripe } from './fakeOperatorStripe.ts';
import { FakeOperatorRepository } from './fakeOperatorRepository.ts';
import { fakeGateDependencies, fakeRepositories } from './serverDependencies.ts';

export const DASHBOARD_COOKIE = 'palier_dashboard';
export const writeHeader = { [DASHBOARD_CSRF_HEADER]: DASHBOARD_CSRF_VALUE };

export function startDashboardServer(settings: ServerSettings = { testSignInEnabled: true }) {
  const driverRepository = new FakeDriverRepository([julie, marc, sophie, pierre, nouvelOperateur]);
  const operatorRepository = new FakeOperatorRepository();
  const stripe = fakeOperatorStripe(operatorRepository);
  const server: FastifyInstance = buildServer({
    gates: fakeGateDependencies(),
    repositories: fakeRepositories({ driverRepository, operatorRepository }),
    operatorStripe: stripe.dependencies,
    settings,
  });
  return { server, driverRepository, ...stripe };
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
