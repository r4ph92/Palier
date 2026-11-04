import type { FastifyBaseLogger } from 'fastify';
import type { CardGateway } from './CardGateway.ts';

interface DetachReplacedCard {
  readonly cardGateway: CardGateway;
  readonly previousPaymentMethodId: string | null;
  readonly currentPaymentMethodId: string;
  readonly log: FastifyBaseLogger;
}

// The new card is already saved, so a failed detach is only logged: the old card stays attached in Stripe but is no longer the default.
export async function detachReplacedCard({ cardGateway, previousPaymentMethodId, currentPaymentMethodId, log }: DetachReplacedCard): Promise<void> {
  if (previousPaymentMethodId === null || previousPaymentMethodId === currentPaymentMethodId) {
    return;
  }
  try {
    await cardGateway.detachPaymentMethod(previousPaymentMethodId);
  } catch (error) {
    log.warn({ err: error }, 'could not detach the replaced card');
  }
}
