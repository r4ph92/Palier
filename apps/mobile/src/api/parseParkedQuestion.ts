import type { ParkedQuestion } from '@palier/shared-types';
import { asRecord } from './asRecord';

// The list only suggests: anything unexpected reads as no question, and the screen still offers the field for any number.
export function parseParkedQuestion(candidate: unknown): ParkedQuestion | null {
  const { aisleCode, freeSpotNumbers } = asRecord(candidate);
  if (typeof aisleCode !== 'string' || !Array.isArray(freeSpotNumbers) || !freeSpotNumbers.every((number) => typeof number === 'string')) {
    return null;
  }
  return { aisleCode, freeSpotNumbers: [...freeSpotNumbers] };
}
