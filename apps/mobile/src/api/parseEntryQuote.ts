import type { EntryQuoteResponse } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { isTariff } from './isTariff';
import { PalierUnreachableError } from './LotsClient';

export function parseEntryQuote(body: unknown): EntryQuoteResponse {
  const { lotName, tariff, holdCents } = asRecord(body);
  if (typeof lotName !== 'string' || !isTariff(tariff) || !Number.isSafeInteger(holdCents) || (holdCents as number) <= 0) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { lotName, tariff, holdCents: holdCents as number };
}
