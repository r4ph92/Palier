import { describe, expect, it } from 'vitest';
import { decideSpotHoldRequest, type SpotHoldFacts } from '../../src/domain/spotHolds/decideSpotHoldRequest.ts';

const openLot: SpotHoldFacts = { isLotOnline: true, ownActiveHold: false, activeHoldsInLot: 0, room: true };

describe('decideSpotHoldRequest', () => {
  it('lets Julie hold a spot in an online lot with room, no hold of her own and the quota unused', () => {
    expect(decideSpotHoldRequest(openLot)).toEqual({ kind: 'proceed' });
  });

  it('lets the third hold of a lot through', () => {
    expect(decideSpotHoldRequest({ ...openLot, activeHoldsInLot: 2 })).toEqual({ kind: 'proceed' });
  });

  it.each([
    ['the lot went offline', { isLotOnline: false }, 'LOT_NOT_IN_SERVICE'],
    ['Julie already holds a spot', { ownActiveHold: true }, 'HOLD_ALREADY_EXISTS'],
    ['Marc and two other drivers use the quota of 3', { activeHoldsInLot: 3 }, 'HOLD_QUOTA_REACHED'],
    ['more holds than the quota exist', { activeHoldsInLot: 4 }, 'HOLD_QUOTA_REACHED'],
    ['vehicles and held spots fill the lot', { room: false }, 'NO_SUITABLE_SPOT'],
  ])('refuses when %s', (_case, change: Partial<SpotHoldFacts>, reason) => {
    expect(decideSpotHoldRequest({ ...openLot, ...change })).toEqual({ kind: 'refuse', reason });
  });

  it.each([
    ['an offline lot before her own hold', { isLotOnline: false, ownActiveHold: true }, 'LOT_NOT_IN_SERVICE'],
    ['her own hold before the quota', { ownActiveHold: true, activeHoldsInLot: 3 }, 'HOLD_ALREADY_EXISTS'],
    ['the quota before the room', { activeHoldsInLot: 3, room: false }, 'HOLD_QUOTA_REACHED'],
  ])('names %s', (_case, change: Partial<SpotHoldFacts>, reason) => {
    expect(decideSpotHoldRequest({ ...openLot, ...change })).toEqual({ kind: 'refuse', reason });
  });
});
