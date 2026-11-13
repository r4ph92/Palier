import { describe, expect, it } from 'vitest';
import { computeCounterGap } from '../../src/domain/dashboard/counterGap.ts';

describe('the gap between the vehicle counter and the places taken', () => {
  it('asks for a check of the difference when the counter is above the places taken', () => {
    expect(computeCounterGap(7, 5)).toEqual({ kind: 'SPOTS_TO_CHECK', spots: 2 });
  });

  it('has nothing to check when the counter equals the places taken', () => {
    expect(computeCounterGap(5, 5)).toEqual({ kind: 'SPOTS_TO_CHECK', spots: 0 });
  });

  it('flags a counter below the places taken, by the difference', () => {
    expect(computeCounterGap(3, 5)).toEqual({ kind: 'COUNTER_BELOW', spots: 2 });
  });

  it('reads an empty lot with no vehicle as nothing to check', () => {
    expect(computeCounterGap(0, 0)).toEqual({ kind: 'SPOTS_TO_CHECK', spots: 0 });
  });
});
