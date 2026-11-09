import type { PaidExit } from '../exits/ExitRepository.ts';
import type { PricingPolicy } from '../pricing/PricingPolicy.ts';

// A session that was closed and paid: everything its receipt is made of.
export interface PaidSession {
  readonly id: string;
  readonly lotName: string;
  readonly enteredAt: Date;
  readonly pricing: PricingPolicy;
  readonly exit: PaidExit;
  // Null for a session opened before the card was recorded on it.
  readonly cardLast4: string | null;
}

export interface ReceiptRepository {
  // The driver's own paid sessions only, newest exit first.
  listPaidSessions(driverId: string): Promise<PaidSession[]>;
  // The driver's own paid session only: another driver's, an open one and an unknown id are all null.
  findPaidSession(sessionId: string, driverId: string): Promise<PaidSession | null>;
}
