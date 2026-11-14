import { describe, expect, it } from 'vitest';
import { aisleDraftErrors, type AisleDraft } from '@palier/shared-types/aisleDraft';
import { boundsOf, isAisleRectangle } from '@palier/shared-types/aisleRectangle';
import { canonicalCodeOf } from '@palier/shared-types/displayText';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { levelDraftErrors } from '@palier/shared-types/levelDraft';

const aisleA: AisleDraft = { code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } };

describe('the rule for a new level', () => {
  it.each(['P1', 'P2', 'Toit', 'é'.repeat(10)])('accepts the code %s', (code) => {
    expect(levelDraftErrors({ code })).toEqual({});
  });

  it.each([
    ['an empty code', '  '],
    ['an 11-character code', 'P'.repeat(11)],
    ['a code of zero-width spaces', '​​'],
  ])('refuses %s', (_case, code) => {
    expect(levelDraftErrors({ code })).toEqual({ code: 'LEVEL_CODE_INVALID' });
  });
});

describe('the rule for a new aisle', () => {
  it('accepts aisle A with minor 1 and a rectangle at the top of the level', () => {
    expect(aisleDraftErrors(aisleA)).toEqual({});
  });

  it.each([
    ['minor 0, the exit lane’s', 0],
    ['minor 65 536, past 16 bits', 65_536],
    ['a negative minor', -1],
    ['a fractional minor', 1.5],
    ['a minor typed as text', Number.NaN],
  ])('refuses %s', (_case, beaconMinor) => {
    expect(aisleDraftErrors({ ...aisleA, beaconMinor })).toEqual({ beaconMinor: 'AISLE_MINOR_INVALID' });
  });

  it.each([1, 65_535])('accepts minor %d', (beaconMinor) => {
    expect(aisleDraftErrors({ ...aisleA, beaconMinor })).toEqual({});
  });

  it('refuses an empty code and a code of 11 characters', () => {
    expect(aisleDraftErrors({ ...aisleA, code: ' ' })).toEqual({ code: 'AISLE_CODE_INVALID' });
    expect(aisleDraftErrors({ ...aisleA, code: 'A'.repeat(11) })).toEqual({ code: 'AISLE_CODE_INVALID' });
  });

  it('refuses each side of a rectangle off the grid on its own field', () => {
    const rectangle = { x: -1, y: 10_001, width: 0, height: Number.NaN };

    expect(aisleDraftErrors({ ...aisleA, rectangle })).toEqual({
      x: 'AISLE_RECTANGLE_INVALID',
      y: 'AISLE_RECTANGLE_INVALID',
      width: 'AISLE_RECTANGLE_INVALID',
      height: 'AISLE_RECTANGLE_INVALID',
    });
  });

  it('answers the code first when every field is wrong', () => {
    const everythingWrong = { code: '', beaconMinor: 0, rectangle: { x: -1, y: 0, width: 1, height: 1 } };

    expect(firstFieldError(aisleDraftErrors(everythingWrong))).toBe('AISLE_CODE_INVALID');
  });

  it('holds the write rule and the read boundary to one rectangle contract', () => {
    expect(isAisleRectangle(aisleA.rectangle)).toBe(true);
    expect(isAisleRectangle({ ...aisleA.rectangle, width: 0 })).toBe(false);
    expect(isAisleRectangle({ ...aisleA.rectangle, label: 'A' })).toBe(false);
  });
});

describe('the bounds of a level plan', () => {
  it('frames aisles A and B of Parking Démo, wherever on the grid they sit', () => {
    const rectangles = [
      { x: 200, y: 300, width: 100, height: 40 },
      { x: 200, y: 350, width: 120, height: 40 },
    ];

    expect(boundsOf(rectangles)).toEqual({ x: 200, y: 300, width: 120, height: 90 });
  });
});

describe('the canonical form of a level or aisle code', () => {
  it.each([
    ['an accent typed decomposed', 'É3', 'É3'],
    ['a no-break space', 'P 1', 'P 1'],
    ['full-width letters and digits', '\uff30\uff11', 'P1'],
    ['a narrow no-break space and a run of spaces', ' P   1 ', 'P 1'],
  ])('reads %s as the code it looks like', (_case, typed, canonical) => {
    expect(canonicalCodeOf(typed)).toBe(canonical);
  });
});
