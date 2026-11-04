import type { EntryResponse } from '@palier/shared-types';
import type { FastifyBaseLogger } from 'fastify';
import type { EligibleEntry } from './EntryEligibility.ts';
import { EntryRefusedError } from './EntryRefusedError.ts';
import type { GateCommander } from './GateCommander.ts';
import type { OpenedSession, ParkingSessionRepository } from './ParkingSessionRepository.ts';
import type { PaymentAuthorizer } from './PaymentAuthorizer.ts';

export type EntryLog = Pick<FastifyBaseLogger, 'warn' | 'error'>;

export interface EntryAdmissionDependencies {
  readonly sessions: ParkingSessionRepository;
  readonly payments: PaymentAuthorizer;
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
    const run: EntryRun = { entry, payments: this.#dependencies.payments, log };
    const session = await this.#openSession(entry);
    const paymentIntentId = await this.#authorize(run, session.id);
    await this.#openBarrier(run, { sessionId: session.id, paymentIntentId });
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

  async #openBarrier(run: EntryRun, { sessionId, paymentIntentId }: HeldSession): Promise<void> {
    const { sessions, gateCommander } = this.#dependencies;
    try {
      await sessions.attachPaymentIntent(sessionId, paymentIntentId);
      await gateCommander.open({ gateId: run.entry.gate.id, lotId: run.entry.gate.lotId, sessionId });
    } catch (error) {
      run.log.error({ err: error, sessionId, paymentIntentId }, 'entry barrier command failed');
      await this.#releaseSpot(sessionId, run.log);
      await this.#releaseHold(run, paymentIntentId);
      throw error;
    }
  }

  // Each undo step only logs its own failure: the next step still runs and the driver gets the original error.
  async #releaseSpot(sessionId: string, log: EntryLog): Promise<void> {
    try {
      await this.#dependencies.sessions.cancel(sessionId);
    } catch (error) {
      log.error({ err: error, sessionId }, 'could not free the entry spot');
    }
  }

  // A hold Stripe would not cancel expires on its own, so it is only logged.
  async #releaseHold({ payments, log }: EntryRun, paymentIntentId: string): Promise<void> {
    try {
      await payments.cancel(paymentIntentId);
    } catch (error) {
      log.error({ err: error, paymentIntentId }, 'could not cancel the entry hold');
    }
  }
}
