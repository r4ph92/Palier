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

const STANDARD = { isElectric: false, hasAccessiblePermit: false, isOversize: false };
const NO_FLAGS = { isEv: false, isAccessible: false, isOversize: false };

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
    const assignedSpot = { id: A1, state: spotId === A1 ? spotState : 'OCCUPIED' } as const;

    expect(placementOf({ sessionState: 'PARKED_PRESUMED', assignedSpot, needs: STANDARD, answeredSpot: { id: spotId, state: spotState, ...NO_FLAGS, heldByAnotherSession: false } })).toEqual(placement);
  });

  it('naming a free spot after an operator freed the presumed one occupies it without flagging the freed spot', () => {
    const assignedSpot = { id: A1, state: 'AVAILABLE' } as const;

    expect(placementOf({ sessionState: 'PARKED_PRESUMED', assignedSpot, needs: STANDARD, answeredSpot: { id: 'spot-a3', state: 'AVAILABLE', ...NO_FLAGS, heldByAnotherSession: false } })).toEqual(OCCUPY);
  });

  it('an asked session naming its own assigned spot occupies it again, as in #21', () => {
    const assignedSpot = { id: A1, state: 'OCCUPIED_UNKNOWN' } as const;

    expect(placementOf({ sessionState: 'PARKED_UNCONFIRMED', needs: STANDARD, assignedSpot, answeredSpot: { ...assignedSpot, ...NO_FLAGS, heldByAnotherSession: false } })).toEqual(OCCUPY);
  });
});

describe('a free spot another active session holds (story #130)', () => {
  const A1 = 'spot-a1';
  const assignedSpot = { id: A1, state: 'OCCUPIED_UNKNOWN' } as const;
  const TAKEN = { outcome: 'refused', refusal: 'spot-taken' };

  it.each(['PARKED_UNCONFIRMED', 'PARKED_PRESUMED'] as const)('refuses it to a %s session as taken', (sessionState) => {
    const answeredSpot = { id: 'spot-a3', state: 'AVAILABLE', ...NO_FLAGS, heldByAnotherSession: true } as const;

    expect(placementOf({ sessionState, needs: STANDARD, assignedSpot, answeredSpot })).toEqual(TAKEN);
  });

  it('says taken, not unsuitable, for a held accessible spot and a standard vehicle', () => {
    const answeredSpot = { id: 'spot-a3', state: 'AVAILABLE', ...NO_FLAGS, isAccessible: true, heldByAnotherSession: true } as const;

    expect(placementOf({ sessionState: 'PARKED_UNCONFIRMED', needs: STANDARD, assignedSpot, answeredSpot })).toEqual(TAKEN);
  });

  it('says taken for an occupied held spot, as for any occupied spot', () => {
    const answeredSpot = { id: 'spot-a3', state: 'OCCUPIED', ...NO_FLAGS, heldByAnotherSession: true } as const;

    expect(placementOf({ sessionState: 'PARKED_UNCONFIRMED', needs: STANDARD, assignedSpot, answeredSpot })).toEqual(TAKEN);
  });

  it('keeps out of service ahead of held', () => {
    const answeredSpot = { id: 'spot-a3', state: 'OUT_OF_SERVICE', ...NO_FLAGS, heldByAnotherSession: true } as const;

    expect(placementOf({ sessionState: 'PARKED_UNCONFIRMED', needs: STANDARD, assignedSpot, answeredSpot })).toEqual({ outcome: 'refused', refusal: 'spot-out-of-service' });
  });
});

describe('which spot a car can be placed on (story #125)', () => {
  const A1 = 'spot-a1';
  const assignedSpot = { id: A1, state: 'OCCUPIED_UNKNOWN' } as const;
  const OCCUPY = { outcome: 'placed', occupiesAnswered: true, flagsAssigned: false };
  const NOT_SUITABLE = { outcome: 'refused', refusal: 'spot-not-suitable' };
  const ELECTRIC_WITH_PERMIT = { isElectric: true, hasAccessiblePermit: true, isOversize: false };

  it.each([
    { naming: 'a free accessible spot, standard vehicle', needs: STANDARD, flags: { isAccessible: true }, state: 'AVAILABLE', placement: NOT_SUITABLE },
    { naming: 'a free electric spot, standard vehicle', needs: STANDARD, flags: { isEv: true }, state: 'AVAILABLE', placement: NOT_SUITABLE },
    { naming: 'a free oversize spot, standard vehicle', needs: STANDARD, flags: { isOversize: true }, state: 'AVAILABLE', placement: OCCUPY },
    { naming: 'a free accessible spot, electric vehicle with a permit', needs: ELECTRIC_WITH_PERMIT, flags: { isAccessible: true }, state: 'AVAILABLE', placement: OCCUPY },
    { naming: 'a free standard spot, oversize vehicle', needs: { ...STANDARD, isOversize: true }, flags: {}, state: 'AVAILABLE', placement: NOT_SUITABLE },
    { naming: 'a taken accessible spot, standard vehicle: taken wins', needs: STANDARD, flags: { isAccessible: true }, state: 'ASSIGNED', placement: { outcome: 'refused', refusal: 'spot-taken' } },
    { naming: 'an out-of-service electric spot, standard vehicle: out of service wins', needs: STANDARD, flags: { isEv: true }, state: 'OUT_OF_SERVICE', placement: { outcome: 'refused', refusal: 'spot-out-of-service' } },
  ] as const)('naming $naming', ({ needs, flags, state, placement }) => {
    const answeredSpot = { id: 'spot-x', state, ...NO_FLAGS, ...flags, heldByAnotherSession: false };

    expect(placementOf({ sessionState: 'PARKED_UNCONFIRMED', needs, assignedSpot, answeredSpot })).toEqual(placement);
  });

  it('never fit-checks the own assigned spot of an asked session, flagged electric since', () => {
    const answeredSpot = { ...assignedSpot, ...NO_FLAGS, isEv: true, heldByAnotherSession: false };

    expect(placementOf({ sessionState: 'PARKED_UNCONFIRMED', needs: STANDARD, assignedSpot, answeredSpot })).toEqual(OCCUPY);
  });

  it('never fit-checks the own presumed spot, flagged accessible since', () => {
    const answeredSpot = { ...assignedSpot, ...NO_FLAGS, isAccessible: true, heldByAnotherSession: false };

    expect(placementOf({ sessionState: 'PARKED_PRESUMED', needs: STANDARD, assignedSpot, answeredSpot })).toEqual(OCCUPY);
  });
});
