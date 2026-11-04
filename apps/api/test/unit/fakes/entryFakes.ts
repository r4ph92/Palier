import type { EntryRefusalCode } from '@palier/shared-types';
import { EntryAdmission, type EntryLog } from '../../../src/domain/entries/EntryAdmission.ts';
import { EntryEligibility, type EntryPolicy } from '../../../src/domain/entries/EntryEligibility.ts';
import type { EntryGate, EntryGateRepository } from '../../../src/domain/entries/EntryGateRepository.ts';
import { EntryRefusedError } from '../../../src/domain/entries/EntryRefusedError.ts';
import type { GateCommander, OpenCommand } from '../../../src/domain/entries/GateCommander.ts';
import type { OpenedSession, ParkingSessionRepository, SessionDraft } from '../../../src/domain/entries/ParkingSessionRepository.ts';
import type { AuthorizationRequest, PaymentAuthorizer } from '../../../src/domain/entries/PaymentAuthorizer.ts';
import type { EntryRouteDependencies } from '../../../src/http/routes/entryRoutes.ts';
import type { FakeDriverRepository } from '../fakeDriverRepository.ts';
import type { FakeVehicleRepository } from '../fakeVehicleRepository.ts';
import { entreeDemo, sortieDemo } from './gateFixtures.ts';

export const ENTREE_DEMO_SECRET = 'uC_Nt1LDTNCeYZC9i6ENFZifPf953v6Hz2vMWeBf2a4';
export const SORTIE_DEMO_SECRET = 'pW-gxvykdybxjEOP6ebx6mGn6K21E1Iu9biLvAvAicQ';
export const ENTREE_ROY_SECRET = 'Qw34Ic7nOubM0aZdCa0HXmkLJ2kxp2hHq8HBd6unq14';
export const LAVOIE_ACCOUNT = 'acct_1Lavoie';

const parkingDemoLot = { id: entreeDemo.lotId, isOnline: true, dailyCapCents: 2500, operatorStripeAccountId: LAVOIE_ACCOUNT };

export const entreeDemoGate: EntryGate = {
  id: entreeDemo.id,
  kind: 'ENTRY',
  integrationKind: 'SIMULATED',
  qrSecret: ENTREE_DEMO_SECRET,
  lot: parkingDemoLot,
};
export const sortieDemoGate: EntryGate = { ...entreeDemoGate, id: sortieDemo.id, kind: 'EXIT', qrSecret: SORTIE_DEMO_SECRET };
export const entreeRoyGate: EntryGate = {
  id: '00000000-0000-4000-8000-000000000703',
  kind: 'ENTRY',
  integrationKind: 'DRY_CONTACT',
  qrSecret: ENTREE_ROY_SECRET,
  lot: { id: '00000000-0000-4000-8000-000000000202', isOnline: false, dailyCapCents: 2500, operatorStripeAccountId: null },
};

export class FakeEntryGateRepository implements EntryGateRepository {
  readonly #gates: Map<string, EntryGate>;

  constructor(gates: readonly EntryGate[] = [entreeDemoGate, sortieDemoGate, entreeRoyGate]) {
    this.#gates = new Map(gates.map((gate) => [gate.id, gate]));
  }

  findGate(gateId: string): Promise<EntryGate | null> {
    return Promise.resolve(this.#gates.get(gateId) ?? null);
  }
}

// Every fake writes the step it ran here, so a test can read the order of the whole entry.
export type Journal = string[];

// Mirrors the SQL order: aisle A before B, then the spot number.
const PARKING_DEMO_SPOTS = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5'];

export class FakeParkingSessionRepository implements ParkingSessionRepository {
  readonly drafts: SessionDraft[] = [];
  readonly paymentIntents = new Map<string, string>();
  cancelFails = false;
  readonly #freeSpots: string[];
  readonly #active = new Map<string, { driverId: string; spot: string }>();
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
    if ([...this.#active.values()].some((session) => session.driverId === draft.driverId)) {
      return Promise.reject(new EntryRefusedError('ALREADY_INSIDE'));
    }
    const spot = this.#freeSpots.shift();
    if (spot === undefined) {
      return Promise.resolve(null);
    }
    const id = `session-${this.drafts.push(draft)}`;
    this.#active.set(id, { driverId: draft.driverId, spot });
    const [aisleCode = ''] = spot.split('-');
    return Promise.resolve({ id, spot: { number: spot, levelCode: 'P1', aisleCode } });
  }

  attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<void> {
    this.#journal.push('attach-intent');
    this.paymentIntents.set(sessionId, paymentIntentId);
    return Promise.resolve();
  }

  cancel(sessionId: string): Promise<void> {
    this.#journal.push('cancel-session');
    if (this.cancelFails) {
      return Promise.reject(new Error('parking_session update failed'));
    }
    const session = this.#active.get(sessionId);
    if (session !== undefined) {
      this.#active.delete(sessionId);
      this.#freeSpots.unshift(session.spot);
    }
    return Promise.resolve();
  }
}

export class FakePaymentAuthorizer implements PaymentAuthorizer {
  readonly authorized: AuthorizationRequest[] = [];
  readonly cancelled: string[] = [];
  refusal: EntryRefusalCode | null = null;
  cancelFails = false;
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

  cancel(paymentIntentId: string): Promise<void> {
    this.#journal.push('cancel-intent');
    if (this.cancelFails) {
      return Promise.reject(new Error('Stripe is down'));
    }
    this.cancelled.push(paymentIntentId);
    return Promise.resolve();
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
}

export function fakeEntries({ drivers, vehicles, policy, gates }: FakeEntriesOptions): FakeEntries {
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
  const admission = new EntryAdmission({ sessions, payments, gateCommander });
  return { journal, sessions, payments, gateCommander, dependencies: { eligibility, admission } };
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
