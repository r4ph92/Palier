import type { EntrySessionState } from '@palier/shared-types';
import { decideRepeatedScan, openingFor, type ActiveSessionFacts } from '../../../src/domain/entries/decideRepeatedScan.ts';
import { EntryRefusedError } from '../../../src/domain/entries/EntryRefusedError.ts';
import type {
  HoldAttachment,
  OpenedSession,
  ParkingSessionRepository,
  SessionDraft,
  SessionOpening,
  SessionStatus,
} from '../../../src/domain/entries/ParkingSessionRepository.ts';

// Every fake writes the step it ran here, so a test can read the order of the whole entry.
export type Journal = string[];

// Mirrors the SQL order: aisle A before B, then the spot number.
const PARKING_DEMO_SPOTS = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5'];

export function fakeSessionId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(900 + sequence).padStart(12, '0')}`;
}

interface FakeSession {
  readonly driverId: string;
  readonly lotId: string;
  readonly entryGateId: string;
  readonly spot: string;
  state: EntrySessionState;
  entryConfirmedAt: Date | null;
  isWithinOpeningWindow: boolean;
}

function assignedSpot(spot: string) {
  const [aisleCode = ''] = spot.split('-');
  return { number: spot, levelCode: 'P1', aisleCode };
}

export class FakeParkingSessionRepository implements ParkingSessionRepository {
  readonly drafts: SessionDraft[] = [];
  readonly paymentIntents = new Map<string, string>();
  cancelFails = false;
  // Stands in for free spots that do not fit the vehicle (chooseSpotFor).
  noSuitableSpot = false;
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

  openOrReplay(draft: SessionDraft): Promise<SessionOpening | null> {
    this.#journal.push('open-session');
    return openingFor(decideRepeatedScan(this.#activeSessionOf(draft.driverId), draft), () => this.#openNew(draft));
  }

  #openNew(draft: SessionDraft): Promise<OpenedSession | null> {
    if (this.noSuitableSpot) {
      return Promise.reject(new EntryRefusedError('NO_SUITABLE_SPOT'));
    }
    const spot = this.#freeSpots.shift();
    if (spot === undefined) {
      return Promise.resolve(null);
    }
    const id = fakeSessionId(this.drafts.push(draft));
    const { driverId, lotId, entryGateId } = draft;
    this.#sessions.set(id, { driverId, lotId, entryGateId, spot, state: 'CREATED', entryConfirmedAt: null, isWithinOpeningWindow: true });
    return Promise.resolve({ id, spot: assignedSpot(spot) });
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

  hasOpeningEntry(driverId: string, lotId: string): Promise<boolean> {
    return Promise.resolve([...this.#sessions.values()].some((session) => session.driverId === driverId && session.lotId === lotId && session.state === 'CREATED'));
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
    return Promise.resolve({ id: sessionId, state: session.state, spot: assignedSpot(session.spot), entryConfirmedAt: session.entryConfirmedAt });
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

  // The opening window passed without a loop closure, as the database clock would tell.
  closeOpeningWindow(sessionId: string): void {
    const session = this.#sessions.get(sessionId);
    if (session !== undefined) {
      session.isWithinOpeningWindow = false;
    }
  }

  #activeSessionOf(driverId: string): ActiveSessionFacts | null {
    for (const [id, session] of this.#sessions) {
      if (session.driverId === driverId && session.state !== 'CANCELLED' && session.state !== 'CLOSED_PAID' && session.state !== 'CLOSED_CAPTURE_PENDING') {
        const { lotId, entryGateId, state, isWithinOpeningWindow } = session;
        return { id, lotId, entryGateId, state, isWithinOpeningWindow, spot: assignedSpot(session.spot) };
      }
    }
    return null;
  }
}
