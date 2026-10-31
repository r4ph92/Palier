import type { PaymentMethodResponse, SavedCard, SavePaymentMethodRequest, SetupIntentResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { Driver } from '../../domain/drivers/Driver.ts';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { CardGateway } from '../../domain/payments/CardGateway.ts';
import { requireConsent } from '../requireConsent.ts';
import { requireDriver, signedInDriver } from '../requireDriver.ts';
import {
  paymentMethodResponseSchema,
  savedCardSchema,
  savePaymentMethodBodySchema,
  setupIntentResponseSchema,
} from '../schemas/paymentMethodSchemas.ts';

const UNPROCESSABLE = 422;
const SERVICE_UNAVAILABLE = 503;

interface SavePaymentMethodRoute {
  readonly Body: SavePaymentMethodRequest;
}

interface CardRoutesContext {
  readonly server: FastifyInstance;
  readonly repository: DriverRepository;
  readonly cardGateway: CardGateway | undefined;
  readonly guards: preHandlerAsyncHookHandler[];
}

// Card routes are gated with onRequest: body validation runs before preHandler, so an unauthenticated request must be refused first.
export function registerPaymentMethodRoutes(server: FastifyInstance, repository: DriverRepository, cardGateway: CardGateway | undefined): void {
  const context: CardRoutesContext = {
    server,
    repository,
    cardGateway,
    guards: [requireDriver(repository), requireConsent(repository)],
  };
  registerReadCardRoute(context);
  registerSetupIntentRoute(context);
  registerSaveCardRoute(context);
}

function registerReadCardRoute({ server, repository, guards }: CardRoutesContext): void {
  server.get('/v1/me/payment-method', { onRequest: guards, schema: { response: { 200: paymentMethodResponseSchema } } }, async (request): Promise<PaymentMethodResponse> => {
    return { card: await repository.findSavedCard(signedInDriver(request).id) };
  });
}

function registerSetupIntentRoute({ server, repository, cardGateway, guards }: CardRoutesContext): void {
  server.post('/v1/me/setup-intent', { onRequest: guards, schema: { response: { 200: setupIntentResponseSchema } } }, async (request, reply) => {
    if (cardGateway === undefined) {
      return unavailable(reply);
    }
    const customerId = await stripeCustomerFor(repository, cardGateway, signedInDriver(request));
    const clientSecret = await cardGateway.createSetupIntentClientSecret(customerId);
    return { clientSecret } satisfies SetupIntentResponse;
  });
}

function registerSaveCardRoute(context: CardRoutesContext): void {
  context.server.put<SavePaymentMethodRoute>(
    '/v1/me/payment-method',
    { onRequest: context.guards, schema: { body: savePaymentMethodBodySchema, response: { 200: savedCardSchema } } },
    (request, reply) => saveCard(context, request, reply),
  );
}

async function saveCard(
  { repository, cardGateway }: CardRoutesContext,
  request: FastifyRequest<SavePaymentMethodRoute>,
  reply: FastifyReply,
) {
  if (cardGateway === undefined) {
    return unavailable(reply);
  }
  const driver = signedInDriver(request);
  const customerId = await repository.findStripeCustomerId(driver.id);
  const paymentMethod = await cardGateway.findCardPaymentMethod(request.body.paymentMethodId);
  // A card counts only when Stripe attached it to this driver's customer, so one driver cannot save another's card.
  if (customerId === null || paymentMethod === null || paymentMethod.customerId !== customerId) {
    return notAttached(reply);
  }
  const card: SavedCard = { brand: paymentMethod.brand, last4: paymentMethod.last4 };
  await repository.saveSavedCard(driver.id, request.body.paymentMethodId, card);
  return card;
}

async function stripeCustomerFor(repository: DriverRepository, cardGateway: CardGateway, driver: Driver): Promise<string> {
  const existing = await repository.findStripeCustomerId(driver.id);
  if (existing !== null) {
    return existing;
  }
  const customerId = await cardGateway.createCustomer(driver);
  await repository.saveStripeCustomerId(driver.id, customerId);
  return customerId;
}

function notAttached(reply: FastifyReply) {
  return reply.status(UNPROCESSABLE).send({
    statusCode: UNPROCESSABLE,
    error: 'PAYMENT_METHOD_NOT_FOUND',
    message: 'This card is not attached to your account.',
  });
}

function unavailable(reply: FastifyReply) {
  return reply.status(SERVICE_UNAVAILABLE).send({
    statusCode: SERVICE_UNAVAILABLE,
    error: 'PAYMENTS_UNAVAILABLE',
    message: 'Card payments are not configured on this server.',
  });
}
