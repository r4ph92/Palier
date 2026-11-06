import type { ParkedSpotAnswerResponse } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { PalierUnreachableError } from './LotsClient';
import { isSpot } from './parseEntry';

export function parseParkedAnswer(body: unknown): ParkedSpotAnswerResponse {
  const { state, spot } = asRecord(body);
  if (state !== 'PARKED_CONFIRMED' || !isSpot(spot)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { state, spot };
}
