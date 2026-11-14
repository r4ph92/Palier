import type { AisleRectangle } from '@palier/shared-types';
import { planFrameOf } from './planFrame.ts';

// No aisle draws thinner than this share of the framed shorter side, so a 10 000 × 40 aisle is still a shape, not a hairline.
const MINIMUM_SIDE_SHARE = 0.08;

// A code reads at this share of the frame's longer side, about 12 to 16 px at the widths the preview takes.
const LABEL_SHARE = 0.035;

// A mono glyph is about this share of the font size wide.
const GLYPH_WIDTH_SHARE = 0.6;

export interface PlanLayout {
  readonly frame: AisleRectangle;
  readonly minimumSide: number;
  readonly labelSize: number;
}

export type LabelPlacement =
  | { readonly kind: 'inside'; readonly x: number; readonly y: number; readonly fontSize: number }
  | { readonly kind: 'beside'; readonly x: number; readonly y: number; readonly fontSize: number; readonly baseline: 'hanging' | 'central' | 'auto' };

// Framed around the aisles as drawn, each at least the minimum side.
export function planLayoutOf(rectangles: readonly AisleRectangle[]): PlanLayout {
  const minimumSide = shorterSideOf(planFrameOf(rectangles)) * MINIMUM_SIDE_SHARE;
  const frame = planFrameOf(rectangles.map((rectangle) => drawnRectangleOf(rectangle, minimumSide)));
  return { frame, minimumSide, labelSize: longerSideOf(frame) * LABEL_SHARE };
}

// Grown to the minimum side around its true centre, so a thin aisle stays where it is on the level.
export function drawnRectangleOf(rectangle: AisleRectangle, minimumSide: number): AisleRectangle {
  const width = Math.max(rectangle.width, minimumSide);
  const height = Math.max(rectangle.height, minimumSide);
  return { x: rectangle.x - (width - rectangle.width) / 2, y: rectangle.y - (height - rectangle.height) / 2, width, height };
}

// Inside when the code fits at a readable size; otherwise beside the aisle: below, to its right, or above, the first with room in the frame.
export function labelPlacementOf(drawn: AisleRectangle, label: string, layout: PlanLayout): LabelPlacement {
  const fontSize = Math.min(drawn.width, drawn.height) / 2;
  if (fontSize >= layout.labelSize && widthOf(label, fontSize) <= drawn.width) {
    return { kind: 'inside', x: drawn.x + drawn.width / 2, y: drawn.y + drawn.height / 2, fontSize };
  }
  return besidePlacementOf(drawn, label, layout);
}

function besidePlacementOf(drawn: AisleRectangle, label: string, { frame, labelSize }: PlanLayout): LabelPlacement {
  const gap = labelSize / 2;
  const below = drawn.y + drawn.height + gap;
  if (below + labelSize <= frame.y + frame.height) {
    return { kind: 'beside', x: drawn.x, y: below, fontSize: labelSize, baseline: 'hanging' };
  }
  const right = drawn.x + drawn.width + gap;
  if (right + widthOf(label, labelSize) <= frame.x + frame.width) {
    return { kind: 'beside', x: right, y: drawn.y + drawn.height / 2, fontSize: labelSize, baseline: 'central' };
  }
  return { kind: 'beside', x: drawn.x, y: drawn.y - gap, fontSize: labelSize, baseline: 'auto' };
}

function widthOf(label: string, fontSize: number): number {
  return [...label].length * fontSize * GLYPH_WIDTH_SHARE;
}

function shorterSideOf({ width, height }: AisleRectangle): number {
  return Math.min(width, height);
}

function longerSideOf({ width, height }: AisleRectangle): number {
  return Math.max(width, height);
}
