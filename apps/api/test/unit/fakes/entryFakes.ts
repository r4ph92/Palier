import type { EntryRefusalCode, EntrySessionState } from '@palier/shared-types';
import { EntryAdmission } from '../../../src/domain/entries/EntryAdmission.ts';
import { EntryEligibility, type EntryPolicy } from '../../../src/domain/entries/EntryEligibility.ts';
import type { EntryGateRepository } from '../../../src/domain/entries/EntryGateRepository.ts';
import type { EntryLog } from '../../../src/domain/entries/EntryLog.ts';
import { EntryRefusedError } from '../../../src/domain/entries/EntryRefusedError.ts';
import type { GateCommander, OpenCommand } from '../../../src/domain/entries/GateCommander.ts';
import type { HoldAttachment, OpenedSession, ParkingSessionRepository, SessionDraft, SessionStatus } from '../../../src/domain/entries/ParkingSessionRepository.ts';
import type { AuthorizationRequest, HoldRelease, PaymentAuthorizer } from '../../../src/domain/entries/PaymentAuthorizer.ts';
import type { EntryRouteDependencies } from '../../../src/http/routes/entryRoutes.ts';
import type { FakeDriverRepository } from '../fakeDriverRepository.ts';
import type { FakeVehicleRepository } from '../fakeVehicleRepository.ts';

import { FakeEntryGateRepository } from './entryGateFakes.ts';

export * from './entryGateFakes.ts';

// Every fake writes the step it ran here, so a test can read the order of the whole entry.
export type Journal = string[];

// Mirrors the SQL order: aisle A before B, then the spot number.
const PARKING_DEMO_SPOTS = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5'];

export function fakeSessionId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(900 + sequence).padStart(12, '0')}`;
}

interface FakeSession {
  readonly driverId: string;
  readonly spot: string;
  state: EntrySessionState;
  entryConfirmedAt: Date | null;
}

export class FakeParkingSessionRepository implements ParkingSessionRepository {
  readonly drafts: SessionDraft[] = [];
  readonly paymentIntents = new Map<string, string>();
  cancelFails = false;
  readonly #freeSpots: string[];
  readonly #sessions = new Map<string, FakeSession>();
  readonly #journal: Journal;

  constructor(journal: Journal = [], freeSpots: readonly string[] = PARKING_DEMO_SPOTS) {
    this.#journal = journal;
    this.#freeSpots = [...freeSpots];
  }

  get freeSpots(): readonly string[] {
    return this.#freeSpots;
  }

  openWithFirstFreeSpot(draft: SessionDraft): Promise<OpenedSession | null> {
    this.#journal.push('open-session');
    if ([...this.#sessions.values()].some((session) => session.state !== 'CANCELLED' && session.driverId === draft.driverId)) {
      return Promise.reject(new EntryRefusedError('ALREADY_INSIDE'));
    }
    const spot = this.#freeSpots.shift();
    if (spot === undefined) {
      return Promise.resolve(null);
    }
    const id = fakeSessionId(this.drafts.push(draft));
    this.#sessions.set(id, { driverId: draft.driverId, spot, state: 'CREATED', entryConfirmedAt: null });
    const [aisleCode = ''] = spot.split('-');
    return Promise.resolve({ id, spot: { number: spot, levelCode: 'P1', aisleCode } });
  }

  attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<HoldAttachment> {
    this.#journal.push('attach-intent');
    const state = this.#sessions.get(sessionId)?.state;
    if (state !== 'CREATED' && state !== 'CANCELLED') {
      return Promise.reject(new Error('parking_session hold not recorded'));
    }
    this.paymentIntents.set(sessionId, paymentIntentId);
    return Promise.resolve(state === 'CANCELLED' ? 'cancelled' : 'attached');
  }

  cancel(sessionId: string): Promise<void> {
    this.#journal.push('cancel-session');
    if (this.cancelFails) {
      return Promise.reject(new Error('parking_session update failed'));
    }
    this.cancelIfCreated(sessionId);
    return Promise.resolve();
  }

  findForUser(sessionId: string, userId: string): Promise<SessionStatus | null> {
    const session = this.#sessions.get(sessionId);
    if (session === undefined || session.driverId !== userId) {
      return Promise.resolve(null);
    }
    const [aisleCode = ''] = session.spot.split('-');
    const spot = { number: session.spot, levelCode: 'P1', aisleCode };
    return Promise.resolve({ id: sessionId, state: session.state, spot, entryConfirmedAt: session.entryConfirmedAt });
  }

  // Mirrors the SQL guard shared by the rollback and the cancellation job: only a CREATED session is cancelled and gives its spot back.
  cancelIfCreated(sessionId: string): void {
    const session = this.#sessions.get(sessionId);
    if (session?.state === 'CREATED') {
      session.state = 'CANCELLED';
      this.#freeSpots.unshift(session.spot);
    }
  }

  confirmEntry(sessionId: string, confirmedAt: Date): void {
    const session = this.#sessions.get(sessionId);
    if (session !== undefined) {
      session.state = 'ENTRY_CONFIRMED';
      session.entryConfirmedAt = confirmedAt;
    }
  }
}

export class FakePaymentAuthorizer implements PaymentAuthorizer {
  readonly authorized: AuthorizationRequest[] = [];
  readonly cancelled: string[] = [];
  refusal: EntryRefusalCode | null = null;
  release: HoldRelease = 'released';
  readonly #journal: Journal;

  constructor(journal: Journal = []) {
    this.#journal = journal;
  }

  authorize(request: AuthorizationRequest): Promise<string> {
    this.#journal.push('authorize');
    if (this.refusal !== null) {
      return Promise.reject(new EntryRefusedError(this.refusal));
    }
    this.authorized.push(request);
    return Promise.resolve(`pi_${request.sessionId}`);
  }

  cancel(paymentIntentId: string): Promise<HoldRelease> {
    this.#journal.push('cancel-intent');
    if (this.release === 'released') {
      this.cancelled.push(paymentIntentId);
    }
    return Promise.resolve(this.release);
  }
}

export class FakeGateCommander implements GateCommander {
  readonly opened: OpenCommand[] = [];
  fails = false;
  readonly #journal: Journal;

  constructor(journal: Journal = []) {
    this.#journal = journal;
  }

  open(command: OpenCommand): Promise<void> {
    this.#journal.push('open-gate');
    if (this.fails) {
      return Promise.reject(new Error('gate_command insert failed'));
    }
    this.opened.push(command);
    return Promise.resolve();
  }
}

export interface FakeEntries {
  readonly journal: Journal;
  readonly sessions: FakeParkingSessionRepository;
  readonly payments: FakePaymentAuthorizer;
  readonly gateCommander: FakeGateCommander;
  readonly dependencies: EntryRouteDependencies;
}

interface FakeEntriesOptions {
  readonly drivers: FakeDriverRepository;
  readonly vehicles: FakeVehicleRepository;
  readonly policy?: EntryPolicy;
  readonly gates?: EntryGateRepository;
  readonly hasPaymentAuthorizer?: boolean;
}

export function fakeEntries({ drivers, vehicles, policy, gates, hasPaymentAuthorizer = true }: FakeEntriesOptions): FakeEntries {
  const journal: Journal = [];
  const sessions = new FakeParkingSessionRepository(journal);
  const payments = new FakePaymentAuthorizer(journal);
  const gateCommander = new FakeGateCommander(journal);
  const eligibility = new EntryEligibility({
    gates: gates ?? new FakeEntryGateRepository(),
    vehicles,
    drivers,
    policy: policy ?? { allowPlatformChargesWithoutOperatorAccount: false },
  });
  const admission = new EntryAdmission({ sessions, payments: hasPaymentAuthorizer ? payments : null, gateCommander });
  return { journal, sessions, payments, gateCommander, dependencies: { eligibility, admission, sessions } };
}

export function silentLog(): EntryLog & { readonly warnings: unknown[]; readonly errors: unknown[] } {
  const warnings: unknown[] = [];
  const errors: unknown[] = [];
  return {
    warnings,
    errors,
    warn: (...values: unknown[]) => void warnings.push(values),
    error: (...values: unknown[]) => void errors.push(values),
  };
}
