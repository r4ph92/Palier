import { describe, expect, it } from 'vitest';
import { normalizeSpotNumber } from '../../src/domain/spots/normalizeSpotNumber.ts';

describe('normalizeSpotNumber', () => {
  it.each([
    ['B-3', 'B-3'],
    ['b-3', 'B-3'],
    ['  B-3  ', 'B-3'],
    ['B3', 'B-3'],
    ['b3', 'B-3'],
    ['B 3', 'B-3'],
    ['B   3', 'B-3'],
    ['B – 3', 'B-3'],
    ['B—3', 'B-3'],
    ['B--3', 'B-3'],
    ['Z-99', 'Z-99'],
    ['AB12', 'AB-12'],
  ])('reads « %s » as « %s »', (typed, normalized) => {
    expect(normalizeSpotNumber(typed)).toBe(normalized);
  });

  it('leaves a number that is only spaces blank, for the route to refuse', () => {
    expect(normalizeSpotNumber('   ')).toBe('');
  });

  it('keeps a number without letters as typed', () => {
    expect(normalizeSpotNumber('12')).toBe('12');
  });
});
