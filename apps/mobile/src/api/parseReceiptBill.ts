import type { ReceiptLine } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { isNonNegativeInteger } from './isNonNegativeInteger';

// The days and the extra of a stay over 24 hours, and what the card refused of it; empty and zero for a shorter stay.
export interface ReceiptBill {
  readonly lines: readonly ReceiptLine[];
  readonly unpaidCents: number;
}

// Null when the body is not a bill: the caller then treats the whole answer as unexpected.
export function parseReceiptBill(receipt: Record<string, unknown>): ReceiptBill | null {
  const { lines, unpaidCents } = receipt;
  if (!Array.isArray(lines) || !isNonNegativeInteger(unpaidCents)) {
    return null;
  }
  const parsed = lines.map(parseLine);
  return parsed.every((line) => line !== null) ? { lines: parsed, unpaidCents } : null;
}

function parseLine(candidate: unknown): ReceiptLine | null {
  const { kind, dayNumber, minutes, cents } = asRecord(candidate);
  if (!isNonNegativeInteger(cents)) {
    return null;
  }
  if (kind === 'DAY' && isNonNegativeInteger(dayNumber)) {
    return { kind, dayNumber, cents };
  }
  return kind === 'EXTRA' && isNonNegativeInteger(minutes) ? { kind, minutes, cents } : null;
}
