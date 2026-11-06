import { describe, expect, it } from 'vitest';
import { decideSessionAnswer, decideSpotAnswer } from '../../src/domain/parkingSessions/ParkedAnswer.ts';

describe('which session takes a spot answer', () => {
  it.each([
    ['PARKED_UNCONFIRMED', 'take-spot'],
    ['PARKED_CONFIRMED', 'already'],
    ['CANCELLED', 'closed'],
    ['CREATED', 'not-asked'],
    ['ENTRY_CONFIRMED', 'not-asked'],
    ['PARKED_PRESUMED', 'not-asked'],
  ] as const)('a session %s: %s', (state, decision) => {
    expect(decideSessionAnswer(state)).toBe(decision);
  });
});

describe('which spot the answer may name (D9)', () => {
  it.each([
    ['AVAILABLE', 'occupy'],
    ['OCCUPIED_UNKNOWN', 'occupy'],
    ['ASSIGNED', 'spot-taken'],
    ['HELD', 'spot-taken'],
    ['OCCUPIED', 'spot-taken'],
    ['OUT_OF_SERVICE', 'spot-out-of-service'],
  ] as const)('a spot %s: %s', (state, decision) => {
    expect(decideSpotAnswer(state)).toBe(decision);
  });
});
