import type { DashboardOperator, StripeOnboardingLink } from '@palier/shared-types';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
import { findOwnOperator, startStripeOnboarding } from '../../domain/dashboard/operatorStripeOnboarding.ts';
import { dashboardOperatorSchema, lotIdParametersSchema, stripeOnboardingLinkSchema } from '../schemas/dashboardSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { requireDashboardUser, signedInDashboardUser } from './requireDashboardUser.ts';

interface OperatorRoute {
  readonly Params: { readonly id: string };
}

interface StripeRoutesContext {
  readonly scope: FastifyInstance;
  readonly dependencies: DashboardRouteDependencies;
  readonly onRequest: onRequestAsyncHookHandler;
}

// The operator id in the path is checked against the signed-in member's own, never trusted: another operator's id, an unknown one and a
// malformed one all get the same 404, so the answer never tells them apart.
export function registerDashboardStripeRoutes(scope: FastifyInstance, dependencies: DashboardRouteDependencies): void {
  const context = { scope, dependencies, onRequest: requireDashboardUser(dependencies.access.sessions) };
  registerReadOperatorRoute(context);
  registerStartOnboardingRoute(context);
}

function registerReadOperatorRoute({ scope, dependencies, onRequest }: StripeRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response: { 200: dashboardOperatorSchema } };
  scope.get<OperatorRoute>('/v1/dashboard/operators/:id', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardOperator> => {
    return findOwnOperator(dependencies.operators, signedInDashboardUser(request).id, operatorIdOf(request));
  });
}

function registerStartOnboardingRoute({ scope, dependencies, onRequest }: StripeRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response: { 200: stripeOnboardingLinkSchema } };
  scope.post<OperatorRoute>('/v1/dashboard/operators/:id/stripe-onboarding', { onRequest, attachValidation: true, schema }, async (request): Promise<StripeOnboardingLink> => {
    const { operators, stripe } = dependencies;
    const userId = signedInDashboardUser(request).id;
    const operatorId = operatorIdOf(request);
    if (stripe === null) {
      await findOwnOperator(operators, userId, operatorId);
      throw new DashboardRefusedError('STRIPE_UNAVAILABLE');
    }
    return { url: await startStripeOnboarding({ operators, ...stripe }, userId, operatorId) };
  });
}

function operatorIdOf(request: { readonly validationError?: Error | undefined; readonly params: { readonly id: string } }): string {
  if (request.validationError !== undefined) {
    throw new DashboardRefusedError('OPERATOR_NOT_FOUND');
  }
  return request.params.id;
}
