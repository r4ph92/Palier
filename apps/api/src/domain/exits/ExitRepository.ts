import type { EntrySessionState } from '@palier/shared-types';
import type { PricingPolicy } from '../pricing/PricingPolicy.ts';

// What an exit reads of the driver's own session before it takes any money.
export interface ExitableSession {
  readonly id: string;
  readonly state: EntrySessionState;
  readonly lotId: string;
  readonly paymentIntentId: string | null;
  readonly authorizedCents: number;
  // When the driver scanned at the entry terminal; billing starts then.
  readonly enteredAt: Date;
  readonly pricing: PricingPolicy;
  // The lot's exit gate (one per lot, OQ12); null when it has none.
  readonly exitGateId: string | null;
  // Set once the session is CLOSED_PAID.
  readonly paidExit: PaidExit | null;
}

export interface PaidExit {
  readonly exitedAt: Date;
  readonly capturedCents: number;
}

export interface ExitClosing {
  readonly sessionId: string;
  readonly lotId: string;
  readonly exitGateId: string;
  readonly exit: PaidExit;
}

// closed: this request closed the session; already: another request did first, and its exit stands.
export type ClosedExit = { readonly outcome: 'closed' | 'already'; readonly exit: PaidExit } | { readonly outcome: 'lot-busy' };

export interface ExitRepository {
  // The driver's own session only: another driver's session is not found, like an unknown id.
  findForExit(sessionId: string, driverId: string): Promise<ExitableSession | null>;
  // One transaction under the lot lock: closes the session as CLOSED_PAID with the app as identification, frees the spots it held
  // and records the gate's open command. A session another request closed first answers that request's exit instead.
  close(closing: ExitClosing): Promise<ClosedExit>;
}
