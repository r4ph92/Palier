import type { EntryRefusalCode } from '@palier/shared-types';
import { EntryAdmission } from '../../../src/domain/entries/EntryAdmission.ts';
import { EntryEligibility } from '../../../src/domain/entries/EntryEligibility.ts';
import { systemClock, type Clock } from '../../../src/domain/time/Clock.ts';
import type { EntryPolicy } from '../../../src/domain/payments/EntryPolicy.ts';
import type { EntryGateRepository } from '../../../src/domain/entries/EntryGateRepository.ts';
import type { EntryLog } from '../../../src/domain/entries/EntryLog.ts';
import { EntryRefusedError } from '../../../src/domain/entries/EntryRefusedError.ts';
import type { GateCommander, OpenCommand } from '../../../src/domain/entries/GateCommander.ts';
import type { AuthorizationRequest, CaptureOutcome, CaptureRequest, HoldRelease, PaymentAuthorizer, SurplusOutcome, SurplusRequest } from '../../../src/domain/entries/PaymentAuthorizer.ts';
import type { EntryRouteDependencies } from '../../../src/http/routes/entryRoutes.ts';
import type { FakeDriverRepository } from '../fakeDriverRepository.ts';
import type { FakeVehicleRepository } from '../fakeVehicleRepository.ts';

import { FakeSpotHoldRepository } from './fakeSpotHolds.ts';
import { FakeEntryGateRepository, STRICT_POLICY } from './entryGateFakes.ts';
import { FakeParkingSessionRepository, type Journal } from './fakeParkingSessions.ts';

export * from './entryGateFakes.ts';
export * from './fakeParkingSessions.ts';

export class FakePaymentAuthorizer implements PaymentAuthorizer {
  readonly authorized: AuthorizationRequest[] = [];
  readonly cancelled: string[] = [];
  refusal: EntryRefusalCode | null = null;
  release: HoldRelease = 'released';
  readonly captured: CaptureRequest[] = [];
  readonly surcharged: SurplusRequest[] = [];
  surplusOutcome: 'charged' | 'declined' | 'failed' = 'charged';
  // What Stripe says it charged when an earlier tap already did; null charges what is asked.
  alreadySurchargedCents: number | null = null;
  captureOutcome: 'captured' | 'failed' = 'captured';
  // What Stripe says it took when an earlier capture already did; null takes what is asked.
  alreadyCapturedCents: number | null = null;
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

  capture(request: CaptureRequest): Promise<CaptureOutcome> {
    this.#journal.push('capture');
    if (this.captureOutcome === 'failed') {
      return Promise.resolve({ outcome: 'failed' });
    }
    this.captured.push(request);
    return Promise.resolve({ outcome: 'captured', amountCents: this.alreadyCapturedCents ?? request.amountCents });
  }

  chargeSurplus(request: SurplusRequest): Promise<SurplusOutcome> {
    this.#journal.push('charge-surplus');
    if (this.surplusOutcome !== 'charged') {
      return Promise.resolve({ outcome: this.surplusOutcome });
    }
    this.surcharged.push(request);
    return Promise.resolve({ outcome: 'charged', amountCents: this.alreadySurchargedCents ?? request.amountCents });
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
  readonly spotHolds?: FakeSpotHoldRepository;
  readonly clock?: Clock;
  readonly hasPaymentAuthorizer?: boolean;
}

export function fakeEntries({ drivers, vehicles, policy, gates, spotHolds = new FakeSpotHoldRepository(), clock = systemClock, hasPaymentAuthorizer = true }: FakeEntriesOptions): FakeEntries {
  const journal: Journal = [];
  const sessions = new FakeParkingSessionRepository(journal);
  const payments = new FakePaymentAuthorizer(journal);
  const gateCommander = new FakeGateCommander(journal);
  const eligibility = new EntryEligibility({
    gates: gates ?? new FakeEntryGateRepository(),
    vehicles,
    drivers,
    policy: policy ?? STRICT_POLICY,
    spotHolds,
    sessions,
  });
  const admission = new EntryAdmission({ sessions, payments: hasPaymentAuthorizer ? payments : null, gateCommander });
  return { journal, sessions, payments, gateCommander, dependencies: { eligibility, admission, sessions, clock } };
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
