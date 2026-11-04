import type { ActiveParkingSession, CurrentParkingSessionQuery } from '../../../src/domain/parkingSessions/ActiveParkingSession.ts';
import type { ParkingSessionBackdater } from '../../../src/domain/parkingSessions/ParkingSessionBackdater.ts';

export const JULIE_SESSION_ID = '00000000-0000-4000-8000-000000000951';

// Julie scanned at Entrée Démo at 18 h 02 local time and got A-1 (story #38, criterion 1).
export function julieAtParkingDemo(enteredAt = new Date(2026, 10, 4, 18, 2)): ActiveParkingSession {
  return {
    id: JULIE_SESSION_ID,
    state: 'ENTRY_CONFIRMED',
    lotName: 'Parking Démo',
    spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
    enteredAt,
    pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
  };
}

interface StoredSession {
  readonly userId: string;
  session: ActiveParkingSession;
  isCancelled: boolean;
}

// The SQL for the current-session read and the backdating is checked on the lane database (docs/decisions/002).
export class FakeCurrentParkingSessions implements CurrentParkingSessionQuery, ParkingSessionBackdater {
  readonly #sessions = new Map<string, StoredSession>();

  add(userId: string, session: ActiveParkingSession): void {
    this.#sessions.set(session.id, { userId, session, isCancelled: false });
  }

  cancel(sessionId: string): void {
    const stored = this.#sessions.get(sessionId);
    if (stored !== undefined) {
      stored.isCancelled = true;
    }
  }

  findCurrentParkingSessionForUser(userId: string): Promise<ActiveParkingSession | null> {
    const stored = [...this.#sessions.values()].find((candidate) => candidate.userId === userId && !candidate.isCancelled);
    return Promise.resolve(stored?.session ?? null);
  }

  backdateEntry(sessionId: string, enteredAt: Date): Promise<boolean> {
    const stored = this.#sessions.get(sessionId);
    if (stored === undefined || stored.isCancelled) {
      return Promise.resolve(false);
    }
    stored.session = { ...stored.session, enteredAt };
    return Promise.resolve(true);
  }
}
