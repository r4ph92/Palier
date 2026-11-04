import type { DashboardSignInResponse, DashboardTestSignInRequest, DashboardTestUserListResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { signInDashboardUser } from '../../domain/dashboard/dashboardSessions.ts';
import { DASHBOARD_TEST_USER_IDS } from '../../config/testPersonas.ts';
import type { SetupLimiter } from '../SetupLimiter.ts';
import { dashboardSignInResponseSchema, dashboardTestSignInBodySchema, dashboardTestUserListSchema } from '../schemas/dashboardSchemas.ts';
import { createSignInLimiter, refuseTooManySignIns } from '../signInLimit.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { setDashboardCookie } from './dashboardSessionCookie.ts';

const NOT_FOUND = 404;

interface TestSignInRoute {
  readonly Body: DashboardTestSignInRequest;
}

interface SignInContext {
  readonly dependencies: DashboardRouteDependencies;
  readonly limiter: SetupLimiter;
}

// Registered only when test sign-in is enabled; otherwise these paths answer 404 like any unknown route.
export function registerDashboardTestSignInRoutes(scope: FastifyInstance, dependencies: DashboardRouteDependencies): void {
  const context: SignInContext = { dependencies, limiter: createSignInLimiter() };
  scope.get('/v1/dashboard/test/users', { schema: { response: { 200: dashboardTestUserListSchema } } }, (): Promise<DashboardTestUserListResponse> =>
    dependencies.access.users.findUsers(DASHBOARD_TEST_USER_IDS),
  );
  scope.post<TestSignInRoute>(
    '/v1/dashboard/test/sign-in',
    { schema: { body: dashboardTestSignInBodySchema, response: { 200: dashboardSignInResponseSchema } } },
    (request, reply) => signInAsTestUser(context, request, reply),
  );
}

async function signInAsTestUser(
  { dependencies, limiter }: SignInContext,
  request: FastifyRequest<TestSignInRoute>,
  reply: FastifyReply,
): Promise<DashboardSignInResponse | FastifyReply> {
  if (!limiter.allow(request.ip)) {
    return refuseTooManySignIns(reply);
  }
  const signedIn = DASHBOARD_TEST_USER_IDS.includes(request.body.userId)
    ? await signInDashboardUser(dependencies.access, request.body.userId)
    : null;
  if (signedIn === null) {
    return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'Not Found', message: 'No such test user.' });
  }
  setDashboardCookie(reply, signedIn.token, dependencies.secureCookies);
  return { user: signedIn.user };
}
