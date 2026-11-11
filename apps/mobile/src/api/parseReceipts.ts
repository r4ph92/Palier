import type { ReceiptDetailResponse, ReceiptListResponse, ReceiptSummary } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { isInstant } from './isInstant';
import { isNonNegativeInteger } from './isNonNegativeInteger';
import { PalierUnreachableError } from './LotsClient';
import { parseReceiptBill } from './parseReceiptBill';

export function parseReceiptList(body: unknown): ReceiptListResponse {
  const { receipts } = asRecord(body);
  if (!Array.isArray(receipts)) {
    throw unexpected();
  }
  return { receipts: receipts.map(parseSummary) };
}

function parseSummary(candidate: unknown): ReceiptSummary {
  const { sessionId, lotName, exitedAt, durationMinutes, totalCents } = asRecord(candidate);
  if (typeof sessionId !== 'string' || typeof lotName !== 'string' || !isInstant(exitedAt) || !isNonNegativeInteger(durationMinutes) || !isNonNegativeInteger(totalCents)) {
    throw unexpected();
  }
  return { sessionId, lotName, exitedAt, durationMinutes, totalCents };
}

export function parseReceiptDetail(body: unknown): ReceiptDetailResponse {
  const receipt = asRecord(asRecord(body)['receipt']);
  const { sessionId, lotName, enteredAt, cardLast4, exitedAt, capped } = receipt;
  const bill = parseReceiptBill(receipt);
  if (bill === null || typeof sessionId !== 'string' || typeof lotName !== 'string' || !isInstant(enteredAt) || !isInstant(exitedAt) || typeof capped !== 'boolean') {
    throw unexpected();
  }
  if (!(cardLast4 === null || typeof cardLast4 === 'string')) {
    throw unexpected();
  }
  return { receipt: { sessionId, lotName, enteredAt, cardLast4, exitedAt, ...countsOf(receipt), capped, ...bill } };
}

function countsOf(receipt: Record<string, unknown>) {
  const { durationMinutes, increments, incrementCents, totalCents } = receipt;
  if (!isNonNegativeInteger(durationMinutes) || !isNonNegativeInteger(increments) || !isNonNegativeInteger(incrementCents) || !isNonNegativeInteger(totalCents)) {
    throw unexpected();
  }
  return { durationMinutes, increments, incrementCents, totalCents };
}

function unexpected(): PalierUnreachableError {
  return new PalierUnreachableError('unexpected response body');
}
