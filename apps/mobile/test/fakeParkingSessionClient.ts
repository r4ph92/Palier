import type { AssignedSpot, CurrentParkingSession, ExitReceipt, ExitResponse, LevelPlan, ParkedPresumptionResponse, ParkedSpotAnswerResponse, SpotTakenResponse } from '@palier/shared-types';
import type { DetectedWalk, ParkingSessionClient } from '../src/api/ParkingSessionClient';
import { spotA1 } from './fakeEntryClient';

export const spotB3: AssignedSpot = { number: 'B-3', levelCode: 'P1', aisleCode: 'B' };
export const spotA2: AssignedSpot = { number: 'A-2', levelCode: 'P1', aisleCode: 'A' };

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
    exitBeaconFallback: false,
    levelPlan: parkingDemoP1Plan,
    question: null,
    ...overrides,
  };
}

// Story #17: aisle A was full, so Julie got B-3.
export function julieAtB3(overrides: Partial<CurrentParkingSession> = {}): CurrentParkingSession {
  return julieAtParkingDemo({ spot: spotB3, ...overrides });
}

export interface ParkedReport extends DetectedWalk {
  readonly sessionId: string;
}

// The free spots of Parking Démo's aisle B as the seed leaves them, Marc's B-4 aside.
export const AISLE_B_FREE_SPOTS = ['B-1', 'B-2', 'B-3', 'B-5'];

export class FakeParkingSessionClient implements ParkingSessionClient {
  session: CurrentParkingSession | null;
  failure: Error | null = null;
  requests = 0;
  holdsAnswer = false;
  readonly parkedReports: ParkedReport[] = [];
  parkedFailure: Error | null = null;
  holdsParkedAnswer = false;
  readonly spotAnswers: string[] = [];
  answerFailure: Error | null = null;
  holdsSpotAnswer = false;
  readonly spotTakenReports: string[] = [];
  spotTakenFailure: Error | null = null;
  holdsSpotTakenReport = false;
  readonly exits: string[] = [];
  readonly exitBeaconReports: { readonly sessionId: string; readonly major: number }[] = [];
  exitBeaconFailure: Error | null = null;
  exitFailure: Error | null = null;
  holdsExit = false;
  // Stripe could not be reached at the exit: the barrier opens and the receipt is null.
  exitsWithCapturePending = false;
  // The receipt the exit answers; a stay over 24 hours sets one with lines.
  exitReceipt: ExitReceipt = { exitedAt: new Date(2026, 10, 4, 21, 17).toISOString(), durationMinutes: 195, increments: 13, incrementCents: 75, totalCents: 975, capped: false, lines: [], unpaidCents: 0 };
  readonly #pendingExits: (() => void)[] = [];
  // The spot Palier gives after a spot-taken report; null when no other spot fits the vehicle.
  replacementSpot: AssignedSpot | null = spotA2;
  readonly #pendingSpotTakenReports: (() => void)[] = [];
  readonly #pendingSpotAnswers: (() => void)[] = [];
  readonly #pending: (() => void)[] = [];
  readonly #pendingParked: (() => void)[] = [];

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

  // Like the API: the walk turns the matching session, and the next read shows it presumed parked, or asked where it parked
  // when the walk came from another aisle of its plan.
  reportParked(sessionId: string, walk: DetectedWalk): Promise<ParkedPresumptionResponse> {
    this.parkedReports.push({ sessionId, ...walk });
    if (this.holdsParkedAnswer) {
      return new Promise((resolve, reject) => this.#pendingParked.push(() => void this.#presumeNow(sessionId, walk).then(resolve, reject)));
    }
    return this.#presumeNow(sessionId, walk);
  }

  // Like the API: an answer places the car in that spot, and the next read shows it parked there.
  answerParkedSpot(sessionId: string, spotNumber: string): Promise<ParkedSpotAnswerResponse> {
    this.spotAnswers.push(spotNumber);
    if (this.holdsSpotAnswer) {
      return new Promise((resolve, reject) => this.#pendingSpotAnswers.push(() => void this.#confirmNow(sessionId, spotNumber).then(resolve, reject)));
    }
    return this.#confirmNow(sessionId, spotNumber);
  }

  // Like the API: the session gets the replacement spot, or is asked where it parked in the reported spot's aisle.
  reportSpotTaken(sessionId: string, spotNumber: string): Promise<SpotTakenResponse> {
    this.spotTakenReports.push(spotNumber);
    if (this.holdsSpotTakenReport) {
      return new Promise((resolve, reject) => this.#pendingSpotTakenReports.push(() => void this.#reassignNow(sessionId).then(resolve, reject)));
    }
    return this.#reassignNow(sessionId);
  }

  // Like the API: the tap closes the session and answers its receipt, 13 increments of 0,75 $ for Julie's 3 h 15.
  exit(sessionId: string): Promise<ExitResponse> {
    this.exits.push(sessionId);
    if (this.holdsExit) {
      return new Promise((resolve, reject) => this.#pendingExits.push(() => void this.#leaveNow(sessionId).then(resolve, reject)));
    }
    return this.#leaveNow(sessionId);
  }

  reportExitBeacon(sessionId: string, major: number): Promise<void> {
    this.exitBeaconReports.push({ sessionId, major });
    return this.exitBeaconFailure === null ? Promise.resolve() : Promise.reject(this.exitBeaconFailure);
  }

  answerExits(): void {
    this.#pendingExits.splice(0).forEach((resolve) => resolve());
  }

  answerSpotTakenReports(): void {
    this.#pendingSpotTakenReports.splice(0).forEach((resolve) => resolve());
  }

  answerSpotAnswers(): void {
    this.#pendingSpotAnswers.splice(0).forEach((resolve) => resolve());
  }

  answerParked(): void {
    this.#pendingParked.splice(0).forEach((resolve) => resolve());
  }

  // Answers every request still waiting, with whatever the fake holds now.
  answer(): void {
    this.#pending.splice(0).forEach((resolve) => resolve());
  }

  #presumeNow(sessionId: string, { detectedAt, aisleMinor }: DetectedWalk): Promise<ParkedPresumptionResponse> {
    if (this.parkedFailure !== null) {
      return Promise.reject(this.parkedFailure);
    }
    const wrongAisleCode = this.session === null ? null : wrongAisleCodeOf(this.session, aisleMinor);
    const state = wrongAisleCode === null ? 'PARKED_PRESUMED' : 'PARKED_UNCONFIRMED';
    if (this.session?.sessionId === sessionId) {
      const question = wrongAisleCode === null ? null : { aisleCode: wrongAisleCode, freeSpotNumbers: [...AISLE_B_FREE_SPOTS] };
      this.session = { ...this.session, state, question };
    }
    return Promise.resolve({ state, parkedAt: new Date(detectedAt).toISOString() });
  }

  #leaveNow(sessionId: string): Promise<ExitResponse> {
    if (this.exitFailure !== null) {
      return Promise.reject(this.exitFailure);
    }
    if (this.session?.sessionId === sessionId) {
      this.session = null;
    }
    if (this.exitsWithCapturePending) {
      return Promise.resolve({ receipt: null });
    }
    return Promise.resolve({ receipt: this.exitReceipt });
  }

  #confirmNow(sessionId: string, spotNumber: string): Promise<ParkedSpotAnswerResponse> {
    if (this.answerFailure !== null) {
      return Promise.reject(this.answerFailure);
    }
    const spot: AssignedSpot = { number: spotNumber, levelCode: 'P1', aisleCode: spotNumber.slice(0, 1) };
    if (this.session?.sessionId === sessionId) {
      this.session = { ...this.session, state: 'PARKED_CONFIRMED', spot, question: null };
    }
    return Promise.resolve({ state: 'PARKED_CONFIRMED', spot });
  }

  #reassignNow(sessionId: string): Promise<SpotTakenResponse> {
    if (this.spotTakenFailure !== null) {
      return Promise.reject(this.spotTakenFailure);
    }
    if (this.session?.sessionId !== sessionId) {
      return Promise.resolve({ outcome: 'none-free' });
    }
    const spot = this.replacementSpot;
    if (spot === null) {
      this.session = { ...this.session, state: 'PARKED_UNCONFIRMED', question: { aisleCode: this.session.spot.aisleCode, freeSpotNumbers: [] } };
      return Promise.resolve({ outcome: 'none-free' });
    }
    this.session = { ...this.session, spot };
    return Promise.resolve({ outcome: 'reassigned', spot });
  }

  #answerNow(): Promise<CurrentParkingSession | null> {
    return this.failure === null ? Promise.resolve(this.session) : Promise.reject(this.failure);
  }
}

function wrongAisleCodeOf(session: CurrentParkingSession, aisleMinor: number | null): string | null {
  const aisle = session.levelPlan?.aisles.find(({ beaconMinor }) => beaconMinor === aisleMinor);
  return aisle === undefined || aisle.code === session.spot.aisleCode ? null : aisle.code;
}
