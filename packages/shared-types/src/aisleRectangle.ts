import type { AisleRectangle } from './parkingSessions.ts';

// A grid larger than this is a typing error, not a parking level (decision 018).
export const AISLE_GRID_LIMIT = 10_000;

export const AISLE_RECTANGLE_KEYS = ['x', 'y', 'width', 'height'] as const;

export type AisleRectangleKey = (typeof AISLE_RECTANGLE_KEYS)[number];

type GridCheck = (candidate: unknown) => candidate is number;

// x and y may sit on the grid's edge.
export function isGridPosition(candidate: unknown): candidate is number {
  return typeof candidate === 'number' && candidate >= 0 && candidate <= AISLE_GRID_LIMIT;
}

// A width or a height of 0 draws nothing.
export function isGridLength(candidate: unknown): candidate is number {
  return isGridPosition(candidate) && candidate > 0;
}

export const GRID_CHECK_OF: Readonly<Record<AisleRectangleKey, GridCheck>> = { x: isGridPosition, y: isGridPosition, width: isGridLength, height: isGridLength };

// The one rectangle contract of decision 018: exactly x, y, width and height, each within the grid.
// The read boundary applies it to the stored jsonb, the dashboard's write rule to each field.
export function isAisleRectangle(candidate: unknown): candidate is AisleRectangle {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return false;
  }
  const entries = Object.entries(candidate);
  return entries.length === AISLE_RECTANGLE_KEYS.length && AISLE_RECTANGLE_KEYS.every((key) => GRID_CHECK_OF[key]((candidate as Record<string, unknown>)[key]));
}

// The smallest rectangle around them all: a level plan frames its drawn aisles, wherever on the grid they sit.
export function boundsOf(rectangles: readonly AisleRectangle[]): AisleRectangle {
  const x = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const y = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));
  return { x, y, width: right - x, height: bottom - y };
}
