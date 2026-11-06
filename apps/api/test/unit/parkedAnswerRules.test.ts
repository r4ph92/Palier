import { describe, expect, it } from 'vitest';
import { decidePlacement, decideSessionAnswer, decideSpotAnswer } from '../../src/domain/parkingSessions/ParkedAnswer.ts';

describe('which session takes a spot answer', () => {
  it.each([
    ['PARKED_UNCONFIRMED', 'take-spot'],
    ['PARKED_CONFIRMED', 'already'],
    ['CANCELLED', 'closed'],
    ['CREATED', 'not-asked'],
    ['ENTRY_CONFIRMED', 'not-asked'],
    ['PARKED_PRESUMED', 'take-spot'],
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

describe('where a presumed session goes once it names its spot (story #22)', () => {
  const A1 = 'spot-a1';

  it.each([
    { naming: 'its own presumed spot', spotId: A1, spotState: 'OCCUPIED', decision: 'keep-presumed' },
    { naming: 'a free spot', spotId: 'spot-a3', spotState: 'AVAILABLE', decision: 'move-from-presumed' },
    { naming: 'a spot left by a driver who walked elsewhere', spotId: 'spot-a3', spotState: 'OCCUPIED_UNKNOWN', decision: 'move-from-presumed' },
    { naming: 'a spot assigned to someone else', spotId: 'spot-b4', spotState: 'ASSIGNED', decision: 'spot-taken' },
    { naming: 'an out-of-service spot', spotId: 'spot-b5', spotState: 'OUT_OF_SERVICE', decision: 'spot-out-of-service' },
  ] as const)('naming $naming: $decision', ({ spotId, spotState, decision }) => {
    expect(decidePlacement({ sessionState: 'PARKED_PRESUMED', assignedSpotId: A1, spotId, spotState })).toBe(decision);
  });

  it('an asked session naming its own assigned spot occupies it again, as in #21', () => {
    expect(decidePlacement({ sessionState: 'PARKED_UNCONFIRMED', assignedSpotId: A1, spotId: A1, spotState: 'OCCUPIED_UNKNOWN' })).toBe('occupy');
  });
});
