import { JULIE_SESSION_ID } from './fakeCurrentParkingSessions.ts';
import type { OpeningWindow } from '../../../src/domain/gates/OpeningWindow.ts';
import type { ClosedExit, ClosedPendingExit, ExitableSession, ExitClosing, ExitRepository, PaidExit, PendingExitClosing, ReadIdentifierKind } from '../../../src/domain/exits/ExitRepository.ts';

export const JULIE_ID = 'driver-julie';
export const EXIT_SESSION_ID = JULIE_SESSION_ID;
export const EXIT_GATE_ID = 'gate-sortie-demo';

// Julie entered at 18 h 02 at 0,75 $ per 15 minutes, capped at 25 $, with the cap held on her card.
export function julieInside(enteredAt: Date): ExitableSession {
  return {
    id: EXIT_SESSION_ID,
    state: 'ENTRY_CONFIRMED',
    lotId: 'lot-demo',
    paymentIntentId: 'pi_julie',
    authorizedCents: 2500,
    enteredAt,
    pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
    exitGateId: EXIT_GATE_ID,
    paidExit: null,
  };
}

export interface ReadKeys {
  readonly plateKey?: string;
  readonly transponderKey?: string;
}

export class FakeExits implements ExitRepository {
  readonly closings: ExitClosing[] = [];
  readonly pendingClosings: PendingExitClosing[] = [];
  busy = false;
  // The lot's beacon major; a report with another one is refused.
  beaconMajor = 1;
  // When each session reported the beacon, and when the console last saw a vehicle, as the fake clock `now` sees them.
  readonly #reports = new Map<string, number>();
  readonly #presences = new Map<string, number>();
  now = 0;
  readonly #sessions = new Map<string, { readonly driverId: string; session: ExitableSession; readonly keys: ReadKeys }>();

  // The keys are what the exit readers can match: the plate of the session and the transponder of its vehicle, without spaces or hyphens.
  add(driverId: string, session: ExitableSession, keys: ReadKeys = {}): void {
    this.#sessions.set(session.id, { driverId, session, keys });
  }

  findLeavableByIdentifier(lotId: string, kind: ReadIdentifierKind, key: string): Promise<readonly ExitableSession[]> {
    const leavable = [...this.#sessions.values()].filter(({ session, keys }) => {
      const state = session.state;
      const open = session.lotId === lotId && state !== 'CREATED' && state !== 'CANCELLED' && state !== 'CLOSED_PAID' && state !== 'CLOSED_CAPTURE_PENDING';
      return open && (kind === 'PLATE' ? keys.plateKey : keys.transponderKey) === key;
    });
    return Promise.resolve(leavable.slice(0, 2).map(({ session }) => session));
  }

  findForExit(sessionId: string, driverId: string): Promise<ExitableSession | null> {
    const found = this.#sessions.get(sessionId);
    return Promise.resolve(found?.driverId === driverId ? found.session : null);
  }

  close(closing: ExitClosing): Promise<ClosedExit> {
    if (this.busy) {
      return Promise.resolve({ outcome: 'lot-busy' });
    }
    const found = this.#sessions.get(closing.sessionId);
    if (found === undefined) {
      throw new Error('Unknown session.');
    }
    if (found.session.paidExit !== null || found.session.state === 'CLOSED_CAPTURE_PENDING') {
      return Promise.resolve({ outcome: 'already', exit: found.session.paidExit });
    }
    const exit: PaidExit = closing.exit;
    this.closings.push(closing);
    found.session = { ...found.session, state: 'CLOSED_PAID', paidExit: exit };
    return Promise.resolve({ outcome: 'closed', exit });
  }

  closeWithPendingCapture(closing: PendingExitClosing): Promise<ClosedPendingExit> {
    if (this.busy) {
      return Promise.resolve({ outcome: 'lot-busy' });
    }
    const found = this.#sessions.get(closing.sessionId);
    if (found === undefined) {
      throw new Error('Unknown session.');
    }
    if (found.session.paidExit !== null || found.session.state === 'CLOSED_CAPTURE_PENDING') {
      return Promise.resolve({ outcome: 'already' });
    }
    this.pendingClosings.push(closing);
    found.session = { ...found.session, state: 'CLOSED_CAPTURE_PENDING' };
    return Promise.resolve({ outcome: 'closed' });
  }

  recordBeaconReport(sessionId: string, major: number): Promise<boolean> {
    const found = this.#sessions.get(sessionId);
    const leavable = found !== undefined && this.#isLeavable(found.session);
    if (!leavable || major !== this.beaconMajor) {
      return Promise.resolve(false);
    }
    this.#reports.set(sessionId, this.now);
    return Promise.resolve(true);
  }

  recordVehiclePresence(gateId: string): Promise<void> {
    this.#presences.set(gateId, this.now);
    return Promise.resolve();
  }

  findBeaconCandidates(lotId: string, window: OpeningWindow): Promise<readonly ExitableSession[]> {
    const fresh = [...this.#sessions.values()].filter(({ session }) => {
      const reportedAt = this.#reports.get(session.id);
      return session.lotId === lotId && this.#isLeavable(session) && reportedAt !== undefined && this.now - reportedAt <= window.withinMilliseconds;
    });
    return Promise.resolve(fresh.slice(0, 2).map(({ session }) => session));
  }

  takeVehiclePresence(gateId: string, window: OpeningWindow): Promise<boolean> {
    const seenAt = this.#presences.get(gateId);
    this.#presences.delete(gateId);
    return Promise.resolve(seenAt !== undefined && this.now - seenAt <= window.withinMilliseconds);
  }

  #isLeavable({ state }: ExitableSession): boolean {
    return state !== 'CREATED' && state !== 'CANCELLED' && state !== 'CLOSED_PAID' && state !== 'CLOSED_CAPTURE_PENDING';
  }
}
