import { describe, expect, it } from 'vitest';
import { AISLE_GRID_LIMIT, aisleRectangleOf } from '../../src/domain/lots/AisleRectangle.ts';

const rectangle = { x: 0, y: 50, width: 100, height: 40 };

describe('aisleRectangleOf', () => {
  it('reads a stored rectangle as drawn', () => {
    expect(aisleRectangleOf(rectangle)).toEqual({ kind: 'drawn', rectangle });
  });

  it('accepts a rectangle that ends on the grid limit', () => {
    const atLimit = { x: AISLE_GRID_LIMIT, y: 0, width: AISLE_GRID_LIMIT, height: 1.5 };

    expect(aisleRectangleOf(atLimit)).toEqual({ kind: 'drawn', rectangle: atLimit });
  });

  it.each([null, undefined])('reads %s as an aisle the operator has not drawn', (stored) => {
    expect(aisleRectangleOf(stored)).toEqual({ kind: 'absent' });
  });

  it.each([
    ['a missing key', { x: 0, y: 0, width: 100 }],
    ['a string coordinate', { ...rectangle, x: '0' }],
    ['a negative x', { ...rectangle, x: -1 }],
    ['a negative y', { ...rectangle, y: -0.5 }],
    ['a zero width', { ...rectangle, width: 0 }],
    ['a negative height', { ...rectangle, height: -40 }],
    ['NaN', { ...rectangle, width: Number.NaN }],
    ['Infinity', { ...rectangle, height: Number.POSITIVE_INFINITY }],
    ['an extra key', { ...rectangle, vertices: [] }],
    ['a value past the grid limit', { ...rectangle, x: AISLE_GRID_LIMIT + 1 }],
    ['a polygon given as an array', [[0, 0], [100, 0], [100, 40]]],
    ['a number', 42],
    ['a string', '{"x":0}'],
  ])('rejects %s', (_case, stored) => {
    expect(aisleRectangleOf(stored)).toEqual({ kind: 'rejected' });
  });
});
