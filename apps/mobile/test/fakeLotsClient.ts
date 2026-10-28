import type { LotListResponse } from '@palier/shared-types';
import { PalierUnreachableError, type LotsClient } from '../src/api/LotsClient';

export type FakeAnswer = LotListResponse | 'unreachable';

export class FakeLotsClient implements LotsClient {
  readonly #answers: FakeAnswer[];
  callCount = 0;

  constructor(...answers: FakeAnswer[]) {
    this.#answers = answers;
  }

  listLots(): Promise<LotListResponse> {
    const answer = this.#answers[Math.min(this.callCount, this.#answers.length - 1)];
    this.callCount += 1;
    if (answer === undefined || answer === 'unreachable') {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    return Promise.resolve(answer);
  }
}

export function parkingDemoWith(freeSpots: number): LotListResponse {
  return [{ id: '00000000-0000-4000-8000-000000000201', name: 'Parking Démo', freeSpots }];
}
