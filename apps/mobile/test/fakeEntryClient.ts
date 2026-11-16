import type { AssignedSpot, EntryQuoteResponse, EntryResponse, EntrySessionState, EntryStatusResponse, TariffPolicy } from '@palier/shared-types';
import type { EntryClient } from '../src/api/EntryClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';

export const ENTREE_DEMO_QR = 'https://palier.app/q/palier1.00000000-0000-4000-8000-000000000701.signature';
export const spotA1: AssignedSpot = { number: 'A-1', levelCode: 'P1', aisleCode: 'A' };
// Parking Démo at 0,75 $ par 15 min, plafond 25,00 $: 25,00 $ held until exit.
export const PARKING_DEMO_TARIFF: TariffPolicy = { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 };
// What Sophie saves while Julie is on the tariff screen.
export const SOPHIE_NEW_TARIFF: TariffPolicy = { incrementCents: 100, incrementMinutes: 15, dailyCapCents: 3000 };

const ADMISSION_REFUSALS = ['NO_SUITABLE_SPOT', 'CARD_DECLINED'];

export class FakeEntryClient implements EntryClient {
  // Each QR the driver scanned, which asks for the lot's tariff.
  readonly scanned: string[] = [];
  // Each tariff an entry named, once the driver tapped « Entrer ».
  readonly enteredAt: TariffPolicy[] = [];
  lotTariff: TariffPolicy = PARKING_DEMO_TARIFF;
  nextRejection: string | null = null;
  nextRejectionCents: number | null = null;
  nextStatus: number | null = null;
  isReachable = true;
  #pending: { resolve: (response: EntryResponse) => void } | null = null;
  holdsAnswer = false;
  readonly statusRequests: string[] = [];
  sessionState: EntrySessionState = 'CREATED';
  failingStatusRequests = 0;
  statusCode: number | null = null;
  statusFailure: Error | null = null;

  // The API refuses a quote as it would the entry, except what only the admission finds: a spot, then the card hold.
  quote(qrContent: string): Promise<EntryQuoteResponse> {
    this.scanned.push(qrContent);
    const failure = this.#failure();
    if (failure !== null && !ADMISSION_REFUSALS.includes(this.nextRejection ?? '')) {
      return Promise.reject(failure);
    }
    return Promise.resolve({ lotName: 'Parking Démo', tariff: this.lotTariff, holdCents: this.lotTariff.dailyCapCents });
  }

  enter(_qrContent: string, tariff: TariffPolicy): Promise<EntryResponse> {
    this.enteredAt.push(tariff);
    const failure = this.#failure();
    if (failure !== null) {
      return Promise.reject(failure);
    }
    if (!sameTariff(tariff, this.lotTariff)) {
      return Promise.reject(new PalierRejectedError('TARIFF_CHANGED', null, this.lotTariff));
    }
    const response: EntryResponse = { sessionId: 'session-1', spot: spotA1, barrierOpened: true };
    if (this.holdsAnswer) {
      return new Promise((resolve) => {
        this.#pending = { resolve };
      });
    }
    return Promise.resolve(response);
  }

  #failure(): Error | null {
    if (!this.isReachable) {
      return new PalierUnreachableError('fake');
    }
    if (this.nextStatus !== null) {
      return new PalierStatusError(this.nextStatus);
    }
    return this.nextRejection === null ? null : new PalierRejectedError(this.nextRejection, this.nextRejectionCents);
  }

  status(sessionId: string): Promise<EntryStatusResponse> {
    this.statusRequests.push(sessionId);
    if (this.failingStatusRequests > 0) {
      this.failingStatusRequests -= 1;
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    if (this.statusFailure !== null) {
      return Promise.reject(this.statusFailure);
    }
    if (this.statusCode !== null) {
      return Promise.reject(new PalierStatusError(this.statusCode));
    }
    const entryConfirmedAt = this.sessionState === 'ENTRY_CONFIRMED' ? '2026-10-27T22:02:00.000Z' : null;
    return Promise.resolve({ sessionId, state: this.sessionState, spot: spotA1, entryConfirmedAt });
  }

  answer(): void {
    this.#pending?.resolve({ sessionId: 'session-1', spot: spotA1, barrierOpened: true });
    this.#pending = null;
  }
}

function sameTariff(left: TariffPolicy, right: TariffPolicy): boolean {
  return left.incrementCents === right.incrementCents && left.incrementMinutes === right.incrementMinutes && left.dailyCapCents === right.dailyCapCents;
}
