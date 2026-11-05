import { isOnEarth } from '@palier/shared-types/lots';
import { describe, expect, it } from 'vitest';

describe('isOnEarth', () => {
  it.each([
    [0, 0, true],
    [90, 180, true],
    [-90, -180, true],
    [90.000001, 0, false],
    [-90.000001, 0, false],
    [0, 180.000001, false],
    [0, -180.000001, false],
    [Number.NaN, 0, false],
    [0, Number.NaN, false],
    [Number.POSITIVE_INFINITY, 0, false],
    [0, Number.NEGATIVE_INFINITY, false],
  ])('latitude %s, longitude %s gives %s', (latitude, longitude, expected) => {
    expect(isOnEarth({ latitude, longitude })).toBe(expected);
  });
});
