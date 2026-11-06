import type { AisleRectangle } from '@palier/shared-types';

// A grid larger than this is a typing error, not a parking level.
export const AISLE_GRID_LIMIT = 10_000;

const RECTANGLE_KEYS = ['x', 'y', 'width', 'height'] as const;

// absent: the operator has not drawn the aisle; rejected: the stored shape is unusable and worth a warning.
export type AisleRectangleReading =
  | { readonly kind: 'drawn'; readonly rectangle: AisleRectangle }
  | { readonly kind: 'absent' }
  | { readonly kind: 'rejected' };

const ABSENT: AisleRectangleReading = { kind: 'absent' };
const REJECTED: AisleRectangleReading = { kind: 'rejected' };

// aisle.map_polygon is untyped jsonb (decision 018): the read boundary turns it into a rectangle or says why not.
export function aisleRectangleOf(storedShape: unknown): AisleRectangleReading {
  if (storedShape === null || storedShape === undefined) {
    return ABSENT;
  }
  if (!hasExactlyRectangleKeys(storedShape)) {
    return REJECTED;
  }
  const { x, y, width, height } = storedShape;
  if (!isGridPosition(x) || !isGridPosition(y) || !isGridLength(width) || !isGridLength(height)) {
    return REJECTED;
  }
  return { kind: 'drawn', rectangle: { x, y, width, height } };
}

function hasExactlyRectangleKeys(candidate: unknown): candidate is Record<(typeof RECTANGLE_KEYS)[number], unknown> {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return false;
  }
  const keys = Object.keys(candidate);
  return keys.length === RECTANGLE_KEYS.length && RECTANGLE_KEYS.every((key) => keys.includes(key));
}

function isGridPosition(candidate: unknown): candidate is number {
  return typeof candidate === 'number' && candidate >= 0 && candidate <= AISLE_GRID_LIMIT;
}

function isGridLength(candidate: unknown): candidate is number {
  return isGridPosition(candidate) && candidate > 0;
}
