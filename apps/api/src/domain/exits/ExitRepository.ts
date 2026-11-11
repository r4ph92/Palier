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
  // A stay over 24 hours bills beyond the card hold: what the card accepted of it, and what it refused (decision 027).
  readonly surplusPaidCents: number;
  readonly unpaidCents: number;
}

// How the vehicle was identified at the exit.
export type ExitIdentification = 'APP' | 'PLATE' | 'TRANSPONDER';

export interface ExitClosing {
  readonly sessionId: string;
  readonly lotId: string;
  readonly exitGateId: string;
  readonly identification: ExitIdentification;
  readonly exit: PaidExit;
}

// The exit of a session whose payment Stripe could not settle: the amounts are fixed now, and the retry takes exactly them.
export interface PendingExitClosing {
  readonly sessionId: string;
  readonly lotId: string;
  readonly exitGateId: string;
  readonly identification: ExitIdentification;
  readonly exitedAt: Date;
  readonly pendingCaptureCents: number;
  // The surplus of a stay over 24 hours the retry charges after the capture; 0 when the hold covers the stay (decision 027).
  readonly pendingSurplusCents: number;
}

// closed: this request closed the session; already: another request did first, and its exit stands (null when that one left the
// capture pending).
export type ClosedExit = { readonly outcome: 'closed'; readonly exit: PaidExit } | { readonly outcome: 'already'; readonly exit: PaidExit | null } | { readonly outcome: 'lot-busy' };

// closed: this request closed the session with its capture pending; already: another request closed it first, paid or pending.
export type ClosedPendingExit = { readonly outcome: 'closed' | 'already' | 'lot-busy' };

// What a gate's reader reads: the plate of the session, or the transponder of its vehicle.
export type ReadIdentifierKind = 'PLATE' | 'TRANSPONDER';

export interface ExitRepository {
  // The driver's own session only: another driver's session is not found, like an unknown id.
  findForExit(sessionId: string, driverId: string): Promise<ExitableSession | null>;
  // Sessions of this lot that have not left and whose plate or vehicle transponder matches the key (spaces and hyphens already
  // removed, upper-case). At most two come back: two are already too many to open on.
  findLeavableByIdentifier(lotId: string, kind: ReadIdentifierKind, key: string): Promise<readonly ExitableSession[]>;
  // One transaction under the lot lock: closes the session as CLOSED_PAID with the app as identification, frees the spots it held
  // and records the gate's open command. A session another request closed first answers that request's exit instead.
  close(closing: ExitClosing): Promise<ClosedExit>;
  // The same transaction, for a capture to retry: the session becomes CLOSED_CAPTURE_PENDING, with no captured amount yet.
  closeWithPendingCapture(closing: PendingExitClosing): Promise<ClosedPendingExit>;
}
