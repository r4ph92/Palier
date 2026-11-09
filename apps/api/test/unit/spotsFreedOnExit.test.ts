import { describe, expect, it } from 'vitest';
import { spotsFreedOnExit, type SpotOfExit } from '../../src/domain/exits/spotsFreedOnExit.ts';

function spot(id: string, state: SpotOfExit['state'], heldByAnotherSession = false): SpotOfExit {
  return { id, state, heldByAnotherSession };
}

describe('spotsFreedOnExit', () => {
  it('frees the spot the car stood in', () => {
    expect(spotsFreedOnExit('B-3', [spot('B-3', 'OCCUPIED')])).toEqual(['B-3']);
  });

  it('frees the confirmed B-3 and the reported A-1 that was left to check', () => {
    expect(spotsFreedOnExit('B-3', [spot('A-1', 'OCCUPIED_UNKNOWN'), spot('B-3', 'OCCUPIED')])).toEqual(['A-1', 'B-3']);
  });

  it('leaves a reported spot another session has taken since', () => {
    expect(spotsFreedOnExit('B-3', [spot('A-1', 'OCCUPIED_UNKNOWN', true), spot('B-3', 'OCCUPIED')])).toEqual(['B-3']);
  });

  it.each(['AVAILABLE', 'HELD', 'ASSIGNED', 'OUT_OF_SERVICE', 'OCCUPIED'] as const)('leaves a reported spot an operator or a hold moved to %s', (state) => {
    expect(spotsFreedOnExit('B-3', [spot('A-1', state), spot('B-3', 'OCCUPIED')])).toEqual(['B-3']);
  });

  it.each(['AVAILABLE', 'OUT_OF_SERVICE'] as const)("leaves the car's own spot an operator already set to %s", (state) => {
    expect(spotsFreedOnExit('B-3', [spot('B-3', state)])).toEqual([]);
  });

  it('frees an own spot the sensors marked OCCUPIED_UNKNOWN', () => {
    expect(spotsFreedOnExit('B-3', [spot('B-3', 'OCCUPIED_UNKNOWN')])).toEqual(['B-3']);
  });
});
