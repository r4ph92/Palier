import type { SpotHold } from '@palier/shared-types';
import { PalierUnreachableError } from '../src/api/LotsClient';
import type { SpotHoldClient } from '../src/api/SpotHoldClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { PARKING_DEMO_ID } from './fakeLotsClient';

// Julie's hold taken at 14 h 02 local time, held until 14 h 17 (story #6, criterion 1).
export function julieHoldAtParkingDemo(overrides: Partial<SpotHold> = {}): SpotHold {
  return {
    spotHoldId: 'hold-1',
    lotId: PARKING_DEMO_ID,
    lotName: 'Parking Démo',
    expiresAt: new Date(2026, 10, 4, 14, 17).toISOString(),
    now: new Date(2026, 10, 4, 14, 2).toISOString(),
    ...overrides,
  };
}

export class FakeSpotHoldClient implements SpotHoldClient {
  readonly heldLots: string[] = [];
  activeHold: SpotHold | null;
  nextRejection: string | null = null;
  nextFailure: Error | null = null;
  isReachable = true;
  // True: a read answers with the server's `now` moved on by the time that passed on the device since the fake was made, as a real server would.
  serverClockRuns = false;
  holdsAnswer = false;
  releasesAnswer = false;
  readonly releasedIds: string[] = [];
  currentRequests = 0;
  readonly #pending: (() => void)[] = [];
  readonly #startedAt = Date.now();

  constructor(current: SpotHold | null = null) {
    this.activeHold = current;
  }

  hold(lotId: string): Promise<SpotHold> {
    this.heldLots.push(lotId);
    if (this.holdsAnswer) {
      return new Promise((resolve, reject) => this.#pending.push(() => void this.#holdNow(lotId).then(resolve, reject)));
    }
    return this.#holdNow(lotId);
  }

  current(): Promise<SpotHold | null> {
    this.currentRequests += 1;
    return this.isReachable ? Promise.resolve(this.#asServerSeesIt(this.activeHold)) : Promise.reject(new PalierUnreachableError('fake'));
  }

  release(spotHoldId: string): Promise<void> {
    this.releasedIds.push(spotHoldId);
    if (this.releasesAnswer) {
      return new Promise((resolve, reject) => this.#pending.push(() => void this.#releaseNow().then(resolve, reject)));
    }
    return this.#releaseNow();
  }

  // Answers every hold or release request still waiting, with whatever the fake is set to answer now.
  answer(): void {
    this.#pending.splice(0).forEach((resolve) => resolve());
  }

  #asServerSeesIt(spotHold: SpotHold | null): SpotHold | null {
    if (spotHold === null || !this.serverClockRuns) {
      return spotHold;
    }
    return { ...spotHold, now: new Date(Date.parse(spotHold.now) + Date.now() - this.#startedAt).toISOString() };
  }

  #releaseNow(): Promise<void> {
    const refusal = this.#refusal();
    if (refusal !== null) {
      return Promise.reject(refusal);
    }
    this.activeHold = null;
    return Promise.resolve();
  }

  #refusal(): Error | null {
    if (this.nextFailure !== null) {
      return this.nextFailure;
    }
    if (!this.isReachable) {
      return new PalierUnreachableError('fake');
    }
    return this.nextRejection === null ? null : new PalierRejectedError(this.nextRejection);
  }

  #holdNow(lotId: string): Promise<SpotHold> {
    const refusal = this.#refusal();
    if (refusal !== null) {
      return Promise.reject(refusal);
    }
    this.activeHold = julieHoldAtParkingDemo({ lotId });
    return Promise.resolve(this.activeHold);
  }
}
