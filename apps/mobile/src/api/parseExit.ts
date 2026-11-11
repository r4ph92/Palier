import type { ExitResponse } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { isInstant } from './isInstant';
import { isNonNegativeInteger } from './isNonNegativeInteger';
import { PalierUnreachableError } from './LotsClient';
import { parseReceiptBill } from './parseReceiptBill';

export function parseExit(body: unknown): ExitResponse {
  const receipt = asRecord(body)['receipt'];
  // The barrier is open but Stripe could not be reached: the receipt follows.
  if (receipt === null) {
    return { receipt: null };
  }
  const { exitedAt, durationMinutes, increments, incrementCents, totalCents, capped } = asRecord(receipt);
  const bill = parseReceiptBill(asRecord(receipt));
  if (
    bill === null ||
    !isInstant(exitedAt) ||
    !isNonNegativeInteger(durationMinutes) ||
    !isNonNegativeInteger(increments) ||
    !isNonNegativeInteger(incrementCents) ||
    !isNonNegativeInteger(totalCents) ||
    typeof capped !== 'boolean'
  ) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { receipt: { exitedAt, durationMinutes, increments, incrementCents, totalCents, capped, ...bill } };
}
