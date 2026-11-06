import type { AssignedSpot, CurrentParkingSession, LevelPlan } from '@palier/shared-types';
import type { ParkingSessionClient } from '../src/api/ParkingSessionClient';
import { spotA1 } from './fakeEntryClient';

export const spotB3: AssignedSpot = { number: 'B-3', levelCode: 'P1', aisleCode: 'B' };

// Level P1 of Parking Démo as the seed draws it: aisle A above aisle B.
export const parkingDemoP1Plan: LevelPlan = {
  levelCode: 'P1',
  aisles: [
    { code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } },
    { code: 'B', beaconMinor: 2, rectangle: { x: 0, y: 50, width: 100, height: 40 } },
  ],
};

// Julie at Parking Démo, entered at 18 h 02 local time and read at 21 h 17 (story #38, criterion 1).
export function julieAtParkingDemo(overrides: Partial<CurrentParkingSession> = {}): CurrentParkingSession {
  return {
    sessionId: 'session-1',
    state: 'ENTRY_CONFIRMED',
    lotName: 'Parking Démo',
    spot: spotA1,
    enteredAt: new Date(2026, 10, 4, 18, 2).toISOString(),
    elapsedMinutes: 195,
    amountCents: 975,
    dailyCapCents: 2500,
    beaconMajor: 1,
    levelPlan: parkingDemoP1Plan,
    ...overrides,
  };
}

// Story #17: aisle A was full, so Julie got B-3.
export function julieAtB3(overrides: Partial<CurrentParkingSession> = {}): CurrentParkingSession {
  return julieAtParkingDemo({ spot: spotB3, ...overrides });
}

export class FakeParkingSessionClient implements ParkingSessionClient {
  session: CurrentParkingSession | null;
  failure: Error | null = null;
  requests = 0;
  holdsAnswer = false;
  readonly #pending: (() => void)[] = [];

  constructor(session: CurrentParkingSession | null = null) {
    this.session = session;
  }

  current(): Promise<CurrentParkingSession | null> {
    this.requests += 1;
    if (this.holdsAnswer) {
      return new Promise((resolve, reject) => this.#pending.push(() => void this.#answerNow().then(resolve, reject)));
    }
    return this.#answerNow();
  }

  // Answers every request still waiting, with whatever the fake holds now.
  answer(): void {
    this.#pending.splice(0).forEach((resolve) => resolve());
  }

  #answerNow(): Promise<CurrentParkingSession | null> {
    return this.failure === null ? Promise.resolve(this.session) : Promise.reject(this.failure);
  }
}
