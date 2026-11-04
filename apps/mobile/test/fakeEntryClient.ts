import type { AssignedSpot, EntryResponse, EntrySessionState, EntryStatusResponse } from '@palier/shared-types';
import type { EntryClient } from '../src/api/EntryClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';

export const ENTREE_DEMO_QR = 'https://palier.app/q/palier1.00000000-0000-4000-8000-000000000701.signature';
export const spotA1: AssignedSpot = { number: 'A-1', levelCode: 'P1', aisleCode: 'A' };

export class FakeEntryClient implements EntryClient {
  readonly scanned: string[] = [];
  nextRejection: string | null = null;
  nextStatus: number | null = null;
  isReachable = true;
  #pending: { resolve: (response: EntryResponse) => void } | null = null;
  holdsAnswer = false;
  readonly statusRequests: string[] = [];
  sessionState: EntrySessionState = 'CREATED';
  failingStatusRequests = 0;

  enter(qrContent: string): Promise<EntryResponse> {
    this.scanned.push(qrContent);
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    if (this.nextStatus !== null) {
      return Promise.reject(new PalierStatusError(this.nextStatus));
    }
    if (this.nextRejection !== null) {
      return Promise.reject(new PalierRejectedError(this.nextRejection));
    }
    const response: EntryResponse = { sessionId: 'session-1', spot: spotA1, barrierOpened: true };
    if (this.holdsAnswer) {
      return new Promise((resolve) => {
        this.#pending = { resolve };
      });
    }
    return Promise.resolve(response);
  }

  status(sessionId: string): Promise<EntryStatusResponse> {
    this.statusRequests.push(sessionId);
    if (this.failingStatusRequests > 0) {
      this.failingStatusRequests -= 1;
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    const entryConfirmedAt = this.sessionState === 'ENTRY_CONFIRMED' ? '2026-10-27T22:02:00.000Z' : null;
    return Promise.resolve({ sessionId, state: this.sessionState, spot: spotA1, entryConfirmedAt });
  }

  answer(): void {
    this.#pending?.resolve({ sessionId: 'session-1', spot: spotA1, barrierOpened: true });
    this.#pending = null;
  }
}
