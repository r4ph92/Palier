import type { AisleRectangle, PlanAisle } from '@palier/shared-types';

type Percent = `${number}%`;

export interface AisleFrame {
  readonly aisle: PlanAisle;
  readonly left: Percent;
  readonly top: Percent;
  readonly width: Percent;
  readonly height: Percent;
}

export interface PlanGeometry {
  // Width over height of the drawn area, so the drawing keeps the level's proportions at any screen width.
  readonly aspectRatio: number;
  readonly frames: readonly AisleFrame[];
}

// The drawing frames the drawn aisles only: positions are percentages of their bounding box, so no layout pass is needed.
export function planGeometryOf(aisles: readonly PlanAisle[]): PlanGeometry | null {
  const drawn = aisles.filter((aisle): aisle is PlanAisle & { rectangle: AisleRectangle } => aisle.rectangle !== null);
  if (drawn.length === 0) {
    return null;
  }
  const bounds = boundsOf(drawn.map(({ rectangle }) => rectangle));
  return { aspectRatio: bounds.width / bounds.height, frames: drawn.map((aisle) => frameOf(aisle, aisle.rectangle, bounds)) };
}

function boundsOf(rectangles: readonly AisleRectangle[]): AisleRectangle {
  const x = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const y = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));
  return { x, y, width: right - x, height: bottom - y };
}

function frameOf(aisle: PlanAisle, rectangle: AisleRectangle, bounds: AisleRectangle): AisleFrame {
  return {
    aisle,
    left: percentOf(rectangle.x - bounds.x, bounds.width),
    top: percentOf(rectangle.y - bounds.y, bounds.height),
    width: percentOf(rectangle.width, bounds.width),
    height: percentOf(rectangle.height, bounds.height),
  };
}

function percentOf(part: number, whole: number): Percent {
  return `${(part / whole) * 100}%`;
}
