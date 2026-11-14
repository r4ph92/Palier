import type { AisleRectangle } from '@palier/shared-types';
import { boundsOf } from '@palier/shared-types/aisleRectangle';

// A margin around the drawing, as a share of its longer side, so the outer strokes are never cut by the frame's edge.
const MARGIN_SHARE = 0.04;

// No frame flatter or taller than this: a long thin aisle still gets a plan tall enough to see.
const MAX_ASPECT_RATIO = 4;

// The part of the level's grid the preview shows: its drawn aisles, a margin, and room to keep a readable shape.
export function planFrameOf(rectangles: readonly AisleRectangle[]): AisleRectangle {
  return withReadableShape(withMargin(boundsOf(rectangles)));
}

function withMargin({ x, y, width, height }: AisleRectangle): AisleRectangle {
  const margin = Math.max(width, height) * MARGIN_SHARE;
  return { x: x - margin, y: y - margin, width: width + 2 * margin, height: height + 2 * margin };
}

// Grows to the right and evenly up and down, so the drawing stays at the left of the preview, centred in its height.
function withReadableShape(frame: AisleRectangle): AisleRectangle {
  const width = Math.max(frame.width, frame.height / MAX_ASPECT_RATIO);
  const height = Math.max(frame.height, frame.width / MAX_ASPECT_RATIO);
  return { x: frame.x, y: frame.y - (height - frame.height) / 2, width, height };
}
