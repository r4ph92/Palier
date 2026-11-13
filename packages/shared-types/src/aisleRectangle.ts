import type { AisleRectangle } from './parkingSessions.ts';

// A grid larger than this is a typing error, not a parking level (decision 018).
export const AISLE_GRID_LIMIT = 10_000;

export const AISLE_RECTANGLE_KEYS = ['x', 'y', 'width', 'height'] as const;

export type AisleRectangleKey = (typeof AISLE_RECTANGLE_KEYS)[number];

// x and y may sit on the grid's edge; a width or a height of 0 draws nothing.
export function isGridValue(key: AisleRectangleKey, candidate: unknown): candidate is number {
  if (typeof candidate !== 'number' || !(candidate >= 0 && candidate <= AISLE_GRID_LIMIT)) {
    return false;
  }
  return key === 'x' || key === 'y' || candidate > 0;
}

// The one rectangle contract of decision 018: exactly x, y, width and height, each within the grid.
// The read boundary applies it to the stored jsonb, the dashboard's write rule to each field.
export function isAisleRectangle(candidate: unknown): candidate is AisleRectangle {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return false;
  }
  const entries = Object.entries(candidate);
  return entries.length === AISLE_RECTANGLE_KEYS.length && AISLE_RECTANGLE_KEYS.every((key) => isGridValue(key, (candidate as Record<string, unknown>)[key]));
}

// The smallest rectangle around them all: a level plan frames its drawn aisles, wherever on the grid they sit.
export function boundsOf(rectangles: readonly AisleRectangle[]): AisleRectangle {
  const x = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const y = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));
  return { x, y, width: right - x, height: bottom - y };
}
