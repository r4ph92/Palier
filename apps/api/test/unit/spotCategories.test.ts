import { describe, expect, it } from 'vitest';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { isInCategory, type SpotFlags } from '../../src/domain/spots/spotCategories.ts';

const NO_FLAG: SpotFlags = { isEv: false, isAccessible: false, isOversize: false };

function categoriesOf(flags: SpotFlags): string[] {
  return SPOT_CATEGORIES.filter((category) => isInCategory(flags, category));
}

describe('isInCategory', () => {
  it.each([
    ['no flag', NO_FLAG, ['standard']],
    ['electric', { ...NO_FLAG, isEv: true }, ['electric']],
    ['accessible', { ...NO_FLAG, isAccessible: true }, ['accessible']],
    ['oversize', { ...NO_FLAG, isOversize: true }, ['oversize']],
    ['electric and accessible', { ...NO_FLAG, isEv: true, isAccessible: true }, ['electric', 'accessible']],
    ['accessible and oversize', { ...NO_FLAG, isAccessible: true, isOversize: true }, ['accessible', 'oversize']],
    ['all three flags', { isEv: true, isAccessible: true, isOversize: true }, ['electric', 'accessible', 'oversize']],
  ])('puts a spot with %s in %j', (_case, flags, expected) => {
    expect(categoriesOf(flags)).toEqual(expected);
  });
});
