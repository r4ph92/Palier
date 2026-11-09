import { JULIE_SESSION_ID } from './fakeCurrentParkingSessions.ts';
import type { ClosedExit, ExitableSession, ExitClosing, ExitRepository, PaidExit } from '../../../src/domain/exits/ExitRepository.ts';

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

export class FakeExits implements ExitRepository {
  readonly closings: ExitClosing[] = [];
  busy = false;
  readonly #sessions = new Map<string, { readonly driverId: string; session: ExitableSession }>();

  add(driverId: string, session: ExitableSession): void {
    this.#sessions.set(session.id, { driverId, session });
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
    if (found.session.paidExit !== null) {
      return Promise.resolve({ outcome: 'already', exit: found.session.paidExit });
    }
    const exit: PaidExit = closing.exit;
    this.closings.push(closing);
    found.session = { ...found.session, state: 'CLOSED_PAID', paidExit: exit };
    return Promise.resolve({ outcome: 'closed', exit });
  }
}
