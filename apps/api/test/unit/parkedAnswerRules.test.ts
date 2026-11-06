import { describe, expect, it } from 'vitest';
import { decideSessionAnswer, decideSpotAnswer, placementOf } from '../../src/domain/parkingSessions/ParkedAnswer.ts';

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

  const KEEP = { outcome: 'placed', occupiesAnswered: false, flagsAssigned: false };
  const MOVE = { outcome: 'placed', occupiesAnswered: true, flagsAssigned: true };
  const OCCUPY = { outcome: 'placed', occupiesAnswered: true, flagsAssigned: false };

  it.each([
    { naming: 'its own presumed spot', spotId: A1, spotState: 'OCCUPIED', placement: KEEP },
    { naming: 'its own presumed spot, occupied-unknown and flagged to check', spotId: A1, spotState: 'OCCUPIED_UNKNOWN', placement: OCCUPY },
    { naming: 'its own presumed spot, set available by hand', spotId: A1, spotState: 'AVAILABLE', placement: OCCUPY },
    { naming: 'its own presumed spot, set out of service by hand', spotId: A1, spotState: 'OUT_OF_SERVICE', placement: { outcome: 'refused', refusal: 'spot-out-of-service' } },
    { naming: 'a free spot', spotId: 'spot-a3', spotState: 'AVAILABLE', placement: MOVE },
    { naming: 'a spot left by a driver who walked elsewhere', spotId: 'spot-a3', spotState: 'OCCUPIED_UNKNOWN', placement: MOVE },
    { naming: 'a spot assigned to someone else', spotId: 'spot-b4', spotState: 'ASSIGNED', placement: { outcome: 'refused', refusal: 'spot-taken' } },
    { naming: 'an out-of-service spot', spotId: 'spot-b5', spotState: 'OUT_OF_SERVICE', placement: { outcome: 'refused', refusal: 'spot-out-of-service' } },
  ] as const)('naming $naming', ({ spotId, spotState, placement }) => {
    expect(placementOf({ sessionState: 'PARKED_PRESUMED', assignedSpotId: A1, answeredSpot: { id: spotId, state: spotState } })).toEqual(placement);
  });

  it('an asked session naming its own assigned spot occupies it again, as in #21', () => {
    expect(placementOf({ sessionState: 'PARKED_UNCONFIRMED', assignedSpotId: A1, answeredSpot: { id: A1, state: 'OCCUPIED_UNKNOWN' } })).toEqual(OCCUPY);
  });
});
