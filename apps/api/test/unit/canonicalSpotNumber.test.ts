import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import { describe, expect, it } from 'vitest';

describe('canonicalSpotNumber', () => {
  it.each([
    ['B-3', 'B3'],
    ['b3', 'B3'],
    [' B 3 ', 'B3'],
    ['B – 3', 'B3'],
    ['B—3', 'B3'],
    ['P1-12', 'P112'],
    ['B-7a', 'B7A'],
    ['B-03', 'B03'],
  ])('reads « %s » as « %s »', (typed, canonical) => {
    expect(canonicalSpotNumber(typed)).toBe(canonical);
  });

  it('leaves a number of spaces and dashes blank, for the route to refuse', () => {
    expect(canonicalSpotNumber(' - ')).toBe('');
  });
});
