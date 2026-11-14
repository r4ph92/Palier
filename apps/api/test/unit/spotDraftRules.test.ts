import { describe, expect, it } from 'vitest';
import { addSpotsErrors, parseSpotRange, spotAttributesErrors, spotNumbersOf, type SpotAttributes, type SpotRange } from '@palier/shared-types/spotDraft';

const standard: SpotAttributes = { isEv: false, isAccessible: false, isOversize: false, distanceToExit: 30 };
const aisleA: SpotRange = { prefix: 'A-', first: '1', last: '20' };

describe('reading a range of spot numbers', () => {
  it.each([
    ['A-1 à A-20', aisleA],
    ['A-1 to A-20', aisleA],
    ['  A-1 À A-20  ', aisleA],
    ['A-1 TO A-20', aisleA],
    ['A-1 à A-20', aisleA],
    ['A-7', { prefix: 'A-', first: '7', last: '7' }],
    ['1 à 20', { prefix: '', first: '1', last: '20' }],
    ['A-01 à A-20', { prefix: 'A-', first: '01', last: '20' }],
    ['P1 B 3 à P1 B 9', { prefix: 'P1 B ', first: '3', last: '9' }],
  ])('reads « %s » in either language', (text, range) => {
    expect(parseSpotRange(text)).toEqual(range);
  });

  it.each([
    ['different prefixes', 'A-1 à B-20'],
    ['prefixes differing in case', 'A-1 à a-20'],
    ['a number without digits', 'A à B'],
    ['an end without digits', 'A-1 à A-'],
    ['three ends', 'A-1 à A-5 à A-9'],
    ['nothing', '   '],
  ])('reads nothing from %s', (_case, text) => {
    expect(parseSpotRange(text)).toBeNull();
  });
});

describe('the rule for spots added to an aisle', () => {
  it('accepts A-1 to A-20, standard, 30 m from the exit', () => {
    expect(addSpotsErrors({ range: aisleA, attributes: standard })).toEqual({});
  });

  it.each([
    ['a range of 200 spots', { prefix: 'A-', first: '1', last: '200' }],
    ['a single spot', { prefix: 'A-', first: '7', last: '7' }],
    ['no prefix', { prefix: '', first: '1', last: '20' }],
    ['a 16-character number', { prefix: 'NIVEAU-P1-A-', first: '9990', last: '9999' }],
  ])('accepts %s', (_case, range) => {
    expect(addSpotsErrors({ range, attributes: standard })).toEqual({});
  });

  it.each([
    ['201 spots in one add', { prefix: 'A-', first: '1', last: '201' }],
    ['a range that runs backwards', { prefix: 'A-', first: '20', last: '1' }],
    ['spot 0', { prefix: 'A-', first: '0', last: '5' }],
    ['seven digits', { prefix: 'A-', first: '1000000', last: '1000001' }],
    ['a 17-character number', { prefix: 'NIVEAU-P1-AB-', first: '9990', last: '9999' }],
    ['an accent in the prefix', { prefix: 'É-', first: '1', last: '2' }],
    ['a leading space', { prefix: ' A-', first: '1', last: '2' }],
    ['a prefix ending in a digit', { prefix: 'A1', first: '5', last: '6' }],
    ['a sign that is not a digit', { prefix: 'A-', first: '-1', last: '2' }],
    ['an invisible character', { prefix: 'A​-', first: '1', last: '2' }],
  ])('refuses %s', (_case, range) => {
    expect(addSpotsErrors({ range, attributes: standard })).toEqual({ range: 'SPOT_RANGE_INVALID' });
  });

  it.each([0, 2000])('accepts %d m from the exit', (distanceToExit) => {
    expect(spotAttributesErrors({ ...standard, distanceToExit })).toEqual({});
  });

  it.each([-1, 2001, 1.5, Number.NaN])('refuses %d m from the exit, on every spot of the range', (distanceToExit) => {
    expect(spotAttributesErrors({ ...standard, distanceToExit })).toEqual({ distanceToExit: 'SPOT_DISTANCE_INVALID' });
    expect(addSpotsErrors({ range: aisleA, attributes: { ...standard, distanceToExit } })).toEqual({ distanceToExit: 'SPOT_DISTANCE_INVALID' });
  });
});

describe('the numbers of a range', () => {
  it('numbers A-1 to A-20 in order', () => {
    const numbers = spotNumbersOf(aisleA);

    expect(numbers).toHaveLength(20);
    expect(numbers.slice(0, 3)).toEqual(['A-1', 'A-2', 'A-3']);
    expect(numbers.at(-1)).toBe('A-20');
  });

  it('keeps the width of the first number: A-01 to A-12', () => {
    expect(spotNumbersOf({ prefix: 'A-', first: '01', last: '12' }).slice(0, 2)).toEqual(['A-01', 'A-02']);
    expect(spotNumbersOf({ prefix: 'A-', first: '08', last: '120' }).at(-1)).toBe('A-120');
  });
});
