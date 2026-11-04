import type { FastifyInstance } from 'fastify';
import { InvalidWebhookSignatureError, type AccountWebhookReader, type OperatorStripeAccounts } from '../../domain/dashboard/OperatorStripe.ts';
import { applyAccountUpdate } from '../../domain/dashboard/operatorStripeOnboarding.ts';

const BAD_REQUEST = 400;

export interface StripeWebhookDependencies {
  readonly reader: AccountWebhookReader;
  readonly accounts: OperatorStripeAccounts;
}

// Stripe signs the exact bytes it sends, so the JSON is kept as a buffer in this scope: parsing it first would break the signature.
// The route takes no cookie and no session: the signature is the only credential, and a notification without a valid one changes nothing.
export function registerStripeWebhookRoute(server: FastifyInstance, { reader, accounts }: StripeWebhookDependencies): void {
  void server.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
    scope.post('/v1/stripe/webhook', async (request, reply) => {
      try {
        const snapshot = reader.read(request.body as Buffer, request.headers['stripe-signature'] as string | undefined);
        if (snapshot !== null) {
          await applyAccountUpdate(accounts, snapshot);
        }
        return { received: true };
      } catch (error) {
        if (error instanceof InvalidWebhookSignatureError) {
          return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'INVALID_SIGNATURE', message: error.message });
        }
        throw error;
      }
    });
  });
}
