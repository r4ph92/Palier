import { describe, expect, it } from 'vitest';
import { decideSpotHoldRequest, type SpotHoldFacts } from '../../src/domain/spotHolds/decideSpotHoldRequest.ts';

const roomForOne = { capacity: 10, vehicleCount: 7, heldSpotCount: 2, assignedSpotCount: 0 };
const full = { capacity: 10, vehicleCount: 8, heldSpotCount: 2, assignedSpotCount: 0 };
const openLot: SpotHoldFacts = { isLotOnline: true, hasOwnActiveHold: false, activeHoldsInLot: 0, holdQuota: 3, occupancy: roomForOne };

describe('decideSpotHoldRequest', () => {
  it('lets Julie hold the last room of an online lot, with no hold of her own and the quota unused', () => {
    expect(decideSpotHoldRequest(openLot)).toEqual({ kind: 'proceed' });
  });

  it('lets the third hold of a lot through', () => {
    expect(decideSpotHoldRequest({ ...openLot, activeHoldsInLot: 2 })).toEqual({ kind: 'proceed' });
  });

  it('lets the fourth hold through when the lot sets a quota of 4, and refuses the fifth', () => {
    expect(decideSpotHoldRequest({ ...openLot, holdQuota: 4, activeHoldsInLot: 3 })).toEqual({ kind: 'proceed' });
    expect(decideSpotHoldRequest({ ...openLot, holdQuota: 4, activeHoldsInLot: 4 })).toEqual({ kind: 'refuse', reason: 'HOLD_QUOTA_REACHED' });
  });

  it('refuses every hold of a lot whose quota is 0', () => {
    expect(decideSpotHoldRequest({ ...openLot, holdQuota: 0 })).toEqual({ kind: 'refuse', reason: 'HOLD_QUOTA_REACHED' });
  });

  it.each([
    ['the lot went offline', { isLotOnline: false }, 'LOT_NOT_IN_SERVICE'],
    ['Julie already holds a spot', { hasOwnActiveHold: true }, 'HOLD_ALREADY_EXISTS'],
    ['Marc and two other drivers use the quota of 3', { activeHoldsInLot: 3 }, 'HOLD_QUOTA_REACHED'],
    ['more holds than the quota exist', { activeHoldsInLot: 4 }, 'HOLD_QUOTA_REACHED'],
    ['vehicles and held spots fill the lot', { occupancy: full }, 'NO_SUITABLE_SPOT'],
  ])('refuses when %s', (_case, change: Partial<SpotHoldFacts>, reason) => {
    expect(decideSpotHoldRequest({ ...openLot, ...change })).toEqual({ kind: 'refuse', reason });
  });

  it.each([
    ['an offline lot before her own hold', { isLotOnline: false, hasOwnActiveHold: true }, 'LOT_NOT_IN_SERVICE'],
    ['her own hold before the quota', { hasOwnActiveHold: true, activeHoldsInLot: 3 }, 'HOLD_ALREADY_EXISTS'],
    ['the quota before the room', { activeHoldsInLot: 3, occupancy: full }, 'HOLD_QUOTA_REACHED'],
  ])('names %s', (_case, change: Partial<SpotHoldFacts>, reason) => {
    expect(decideSpotHoldRequest({ ...openLot, ...change })).toEqual({ kind: 'refuse', reason });
  });
});
