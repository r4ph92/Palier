import fastifyCookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { signOutDashboardUser } from '../../domain/dashboard/dashboardSessions.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { registerDashboardOperatorRoutes } from './dashboardOperatorRoutes.ts';
import { registerDashboardStripeRoutes } from './dashboardStripeRoutes.ts';
import { clearDashboardCookie, dashboardCookieToken } from './dashboardSessionCookie.ts';
import { registerDashboardTestSignInRoutes } from './dashboardTestSignInRoutes.ts';
import { handleDashboardError } from './handleDashboardError.ts';
import { requireDashboardWriteHeader } from './requireDashboardWriteHeader.ts';

const NO_CONTENT = 204;

// The cookie plugin, the write header and the error handler stay inside this scope: the app's routes never read cookies.
export async function registerDashboardRoutes(scope: FastifyInstance, dependencies: DashboardRouteDependencies): Promise<void> {
  await scope.register(fastifyCookie);
  scope.decorateRequest('dashboardUser', null);
  scope.setErrorHandler(handleDashboardError);
  scope.addHook('onRequest', requireDashboardWriteHeader);
  registerSignOutRoute(scope, dependencies);
  registerDashboardOperatorRoutes(scope, dependencies);
  registerDashboardStripeRoutes(scope, dependencies);
  if (dependencies.testSignInEnabled) {
    registerDashboardTestSignInRoutes(scope, dependencies);
  }
}

// Signing out always clears the cookie, even when the session had already ended.
function registerSignOutRoute(scope: FastifyInstance, { access, secureCookies }: DashboardRouteDependencies): void {
  scope.post('/v1/dashboard/sign-out', async (request, reply) => {
    const token = dashboardCookieToken(request);
    if (token !== null) {
      await signOutDashboardUser(access.sessions, token);
    }
    clearDashboardCookie(reply, secureCookies);
    return reply.status(NO_CONTENT).send();
  });
}
