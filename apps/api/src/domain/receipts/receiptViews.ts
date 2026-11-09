import type { ReceiptDetail, ReceiptSummary } from '@palier/shared-types';
import { receiptOf } from '../exits/exitParking.ts';
import type { PaidSession } from './ReceiptRepository.ts';

// The figures come from the same receiptOf as the exit tap, so the history never disagrees with the receipt the driver saw leaving.
export function receiptSummaryOf(session: PaidSession): ReceiptSummary {
  const { exitedAt, durationMinutes, totalCents } = receiptOf(session, session.exit);
  return { sessionId: session.id, lotName: session.lotName, exitedAt, durationMinutes, totalCents };
}

export function receiptDetailOf(session: PaidSession): ReceiptDetail {
  return {
    sessionId: session.id,
    lotName: session.lotName,
    enteredAt: session.enteredAt.toISOString(),
    cardLast4: session.cardLast4,
    ...receiptOf(session, session.exit),
  };
}
