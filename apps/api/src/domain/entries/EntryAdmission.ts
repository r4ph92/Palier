import type { EntryResponse } from '@palier/shared-types';
import type { FastifyBaseLogger } from 'fastify';
import type { EligibleEntry } from './EntryEligibility.ts';
import { EntryRefusedError } from './EntryRefusedError.ts';
import type { GateCommander } from './GateCommander.ts';
import type { ParkingSessionRepository } from './ParkingSessionRepository.ts';
import type { PaymentAuthorizer } from './PaymentAuthorizer.ts';

export type EntryLog = Pick<FastifyBaseLogger, 'warn' | 'error'>;

export interface EntryAdmissionDependencies {
  readonly sessions: ParkingSessionRepository;
  readonly payments: PaymentAuthorizer;
  readonly gateCommander: GateCommander;
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
    const paymentIntentId = await this.#authorize(entry, session.id, log);
    await this.#openBarrier(entry, { sessionId: session.id, paymentIntentId }, log);
    return { sessionId: session.id, spot: session.spot, barrierOpened: true };
  }

  async #authorize(entry: EligibleEntry, sessionId: string, log: EntryLog): Promise<string> {
    if (entry.payment.destinationAccountId === null) {
      log.warn({ sessionId }, 'demo mode: the operator has no Stripe account, the hold stays on the platform');
    }
    try {
      return await this.#dependencies.payments.authorize({ ...entry.payment, sessionId });
    } catch (error) {
      // The intent, if Stripe created one, carries this session id in its metadata.
      log.warn({ err: error, sessionId }, 'entry authorization failed');
      await this.#dependencies.sessions.cancel(sessionId);
      throw error;
    }
  }

  async #openBarrier(entry: EligibleEntry, { sessionId, paymentIntentId }: HeldSession, log: EntryLog): Promise<void> {
    const { sessions, gateCommander } = this.#dependencies;
    try {
      await sessions.attachPaymentIntent(sessionId, paymentIntentId);
      await gateCommander.open({ gateId: entry.gate.id, lotId: entry.gate.lotId, sessionId });
    } catch (error) {
      log.error({ err: error, sessionId, paymentIntentId }, 'entry barrier command failed');
      await sessions.cancel(sessionId);
      await this.#releaseHold(paymentIntentId, log);
      throw error;
    }
  }

  // The spot is already free again; a hold Stripe would not cancel expires on its own, so it is only logged.
  async #releaseHold(paymentIntentId: string, log: EntryLog): Promise<void> {
    try {
      await this.#dependencies.payments.cancel(paymentIntentId);
    } catch (error) {
      log.error({ err: error, paymentIntentId }, 'could not cancel the entry hold');
    }
  }
}
