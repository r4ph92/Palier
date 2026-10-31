import type { SavedCard } from '@palier/shared-types';
import { PalierUnreachableError } from './LotsClient';

export function parsePaymentCard(body: unknown): SavedCard | null {
  const { card } = asRecord(body);
  if (card === null) {
    return null;
  }
  if (!isSavedCard(card)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return card;
}

export function parseSavedCard(body: unknown): SavedCard {
  if (!isSavedCard(body)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return body;
}

export function parseClientSecret(body: unknown): string {
  const { clientSecret } = asRecord(body);
  if (typeof clientSecret !== 'string') {
    throw new PalierUnreachableError('unexpected response body');
  }
  return clientSecret;
}

function isSavedCard(candidate: unknown): candidate is SavedCard {
  const { brand, last4 } = asRecord(candidate);
  return typeof brand === 'string' && typeof last4 === 'string';
}

function asRecord(candidate: unknown): Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null ? (candidate as Record<string, unknown>) : {};
}
