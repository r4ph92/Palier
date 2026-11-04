import type { EntryResponse } from '@palier/shared-types';
import type { EligibleEntry } from './EntryEligibility.ts';
import type { EntryLog } from './EntryLog.ts';
import { EntryRefusedError } from './EntryRefusedError.ts';
import type { GateCommander } from './GateCommander.ts';
import type { HoldAttachment, OpenedSession, ParkingSessionRepository } from './ParkingSessionRepository.ts';
import type { PaymentAuthorizer } from './PaymentAuthorizer.ts';

export interface EntryAdmissionDependencies {
  readonly sessions: ParkingSessionRepository;
  // Null when the server has no Stripe key: the QR checks still answer, the entry stops before a spot is taken.
  readonly payments: PaymentAuthorizer | null;
  readonly gateCommander: GateCommander;
}

interface EntryRun {
  readonly entry: EligibleEntry;
  readonly payments: PaymentAuthorizer;
  readonly log: EntryLog;
}

interface HeldSession {
  readonly sessionId: string;
  readonly paymentIntentId: string;
}

// Spot, then card hold, then barrier (docs/03); a failed step undoes the earlier ones before the error leaves.
export class EntryAdmission {
  readonly #dependencies: EntryAdmissionDependencies;

  constructor(dependencies: EntryAdmissionDependencies) {
    this.#dependencies = dependencies;
  }

  async admit(entry: EligibleEntry, log: EntryLog): Promise<EntryResponse> {
    const { payments } = this.#dependencies;
    if (payments === null) {
      throw new EntryRefusedError('PAYMENTS_UNAVAILABLE');
    }
    const run: EntryRun = { entry, payments, log };
    const session = await this.#openSession(entry);
    const held: HeldSession = { sessionId: session.id, paymentIntentId: await this.#authorize(run, session.id) };
    if ((await this.#attachHold(run, held)) === 'cancelled') {
      await this.#refuseCancelledEntry(run, held);
    }
    await this.#openBarrier(run, held);
    return { sessionId: session.id, spot: session.spot, barrierOpened: true };
  }

  async #openSession(entry: EligibleEntry): Promise<OpenedSession> {
    const session = await this.#dependencies.sessions.openWithFirstFreeSpot({
      driverId: entry.driverId,
      vehicleId: entry.vehicle.id,
      plate: entry.vehicle.plate,
      lotId: entry.gate.lotId,
      entryGateId: entry.gate.id,
      authorizedCents: entry.payment.amountCents,
      pricing: entry.pricing,
    });
    if (session === null) {
      throw new EntryRefusedError('LOT_FULL');
    }
    return session;
  }

  async #authorize({ entry, payments, log }: EntryRun, sessionId: string): Promise<string> {
    if (entry.payment.destinationAccountId === null) {
      log.warn({ sessionId }, 'demo mode: the operator has no Stripe account, the hold stays on the platform');
    }
    try {
      return await payments.authorize({ ...entry.payment, sessionId });
    } catch (error) {
      // The intent, if Stripe created one, carries this session id in its metadata.
      log.warn({ err: error, sessionId }, 'entry authorization failed');
      await this.#releaseSpot(sessionId, log);
      throw error;
    }
  }

  async #attachHold(run: EntryRun, held: HeldSession): Promise<HoldAttachment> {
    try {
      return await this.#dependencies.sessions.attachPaymentIntent(held.sessionId, held.paymentIntentId);
    } catch (error) {
      run.log.error({ err: error, ...held }, 'entry hold was not recorded');
      await this.#undo(run, held);
      throw error;
    }
  }

  // An entry slower than the confirmation window was cancelled by the job: its spot is already free, the barrier stays shut.
  async #refuseCancelledEntry(run: EntryRun, held: HeldSession): Promise<never> {
    run.log.warn(held, 'entry cancelled before its hold was recorded');
    await this.#releaseHold(run, held.paymentIntentId);
    throw new EntryRefusedError('PAYMENTS_UNAVAILABLE');
  }

  async #openBarrier(run: EntryRun, held: HeldSession): Promise<void> {
    try {
      await this.#dependencies.gateCommander.open({ gateId: run.entry.gate.id, lotId: run.entry.gate.lotId, sessionId: held.sessionId });
    } catch (error) {
      run.log.error({ err: error, ...held }, 'entry barrier was not opened');
      await this.#undo(run, held);
      throw error;
    }
  }

  async #undo(run: EntryRun, { sessionId, paymentIntentId }: HeldSession): Promise<void> {
    await this.#releaseSpot(sessionId, run.log);
    await this.#releaseHold(run, paymentIntentId);
  }

  // Each undo step only logs its own failure: the next step still runs and the driver gets the original error.
  async #releaseSpot(sessionId: string, log: EntryLog): Promise<void> {
    try {
      await this.#dependencies.sessions.cancel(sessionId);
    } catch (error) {
      log.error({ err: error, sessionId }, 'could not free the entry spot');
    }
  }

  // The cancelled session keeps its hold marked for release, so the cancellation job retries one Stripe did not release here.
  async #releaseHold({ payments, log }: EntryRun, paymentIntentId: string): Promise<void> {
    try {
      const release = await payments.cancel(paymentIntentId);
      if (release !== 'released') {
        log.error({ paymentIntentId, release }, 'could not cancel the entry hold');
      }
    } catch (error) {
      log.error({ err: error, paymentIntentId }, 'could not cancel the entry hold');
    }
  }
}
