import type { SpotHold } from '@palier/shared-types';
import { PalierUnreachableError } from '../src/api/LotsClient';
import type { SpotHoldClient } from '../src/api/SpotHoldClient';
import { PalierRejectedError } from '../src/api/VehicleClient';

export const PARKING_DEMO_ID = '00000000-0000-4000-8000-000000000201';

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
  holdsAnswer = false;
  currentRequests = 0;
  readonly #pending: (() => void)[] = [];

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
    return this.isReachable ? Promise.resolve(this.activeHold) : Promise.reject(new PalierUnreachableError('fake'));
  }

  // Answers every hold request still waiting, with whatever the fake is set to answer now.
  answer(): void {
    this.#pending.splice(0).forEach((resolve) => resolve());
  }

  #holdNow(lotId: string): Promise<SpotHold> {
    if (this.nextFailure !== null) {
      return Promise.reject(this.nextFailure);
    }
    if (!this.isReachable) {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    if (this.nextRejection !== null) {
      return Promise.reject(new PalierRejectedError(this.nextRejection));
    }
    this.activeHold = julieHoldAtParkingDemo({ lotId });
    return Promise.resolve(this.activeHold);
  }
}
