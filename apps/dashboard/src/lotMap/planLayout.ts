import type { AisleRectangle } from '@palier/shared-types';
import { planFrameOf } from './planFrame.ts';

// No aisle draws thinner than this share of the framed shorter side, so a 10 000 × 40 aisle is still a shape, not a hairline.
const MINIMUM_SIDE_SHARE = 0.08;

// A code reads at this share of the frame's longer side, about 12 to 16 px at the widths the preview takes.
const LABEL_SHARE = 0.035;

// A mono glyph is 0.6 em wide; the estimate errs wide, since a label box only ever grows the frame.
const GLYPH_WIDTH_SHARE = 0.65;

// Emoji and East Asian wide characters take two glyph widths.
const WIDE_CHARACTER = /[\p{Extended_Pictographic}\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u;

export interface PlanAisleShape {
  readonly rectangle: AisleRectangle;
  readonly label: string;
}

// box is the area the label's glyphs take on the grid, inside or beside its aisle.
export interface LabelPlacement {
  readonly kind: 'inside' | 'beside';
  readonly x: number;
  readonly y: number;
  readonly fontSize: number;
  readonly anchor: 'start' | 'middle';
  readonly baseline: 'hanging' | 'central';
  readonly box: AisleRectangle;
}

export interface PlacedAisle {
  readonly drawn: AisleRectangle;
  readonly label: string;
  readonly placement: LabelPlacement;
}

export interface PlanLayout {
  readonly frame: AisleRectangle;
  readonly aisles: readonly PlacedAisle[];
}

// Two passes: the second sizes the thinnest aisle against the frame the first one found, labels included,
// so a frame grown to hold a label never shrinks an aisle back to a hairline.
export function planLayoutOf(aisles: readonly PlanAisleShape[]): PlanLayout {
  const firstPass = layoutWith(aisles, shorterSideOf(planFrameOf(aisles.map(({ rectangle }) => rectangle))) * MINIMUM_SIDE_SHARE);
  return layoutWith(aisles, shorterSideOf(firstPass.frame) * MINIMUM_SIDE_SHARE);
}

// The frame holds every drawn aisle and every label box, with the frame's margin, so nothing is cut by the svg's edge.
function layoutWith(aisles: readonly PlanAisleShape[], minimumSide: number): PlanLayout {
  const drawn = aisles.map(({ rectangle, label }) => ({ drawn: drawnRectangleOf(rectangle, minimumSide), label }));
  const drawnFrame = planFrameOf(drawn.map((aisle) => aisle.drawn));
  const labelSize = longerSideOf(drawnFrame) * LABEL_SHARE;
  const placed = drawn.map((aisle) => ({ ...aisle, placement: labelPlacementOf(aisle.drawn, aisle.label, { frame: drawnFrame, labelSize }) }));
  return { frame: planFrameOf(placed.flatMap(({ drawn: rectangle, placement }) => [rectangle, placement.box])), aisles: placed };
}

// Grown to the minimum side around its true centre, so a thin aisle stays where it is on the level.
export function drawnRectangleOf(rectangle: AisleRectangle, minimumSide: number): AisleRectangle {
  const width = Math.max(rectangle.width, minimumSide);
  const height = Math.max(rectangle.height, minimumSide);
  return { x: rectangle.x - (width - rectangle.width) / 2, y: rectangle.y - (height - rectangle.height) / 2, width, height };
}

interface LabelRoom {
  readonly frame: AisleRectangle;
  readonly labelSize: number;
}

// Inside when the code fits at a readable size; otherwise beside the aisle.
function labelPlacementOf(drawn: AisleRectangle, label: string, room: LabelRoom): LabelPlacement {
  const fontSize = Math.min(drawn.width, drawn.height) / 2;
  const width = widthOf(label, fontSize);
  if (fontSize < room.labelSize || width > drawn.width) {
    return besidePlacementOf(drawn, widthOf(label, room.labelSize), room);
  }
  const x = drawn.x + drawn.width / 2;
  const y = drawn.y + drawn.height / 2;
  const box = { x: x - width / 2, y: y - fontSize / 2, width, height: fontSize };
  return { kind: 'inside', x, y, fontSize, anchor: 'middle', baseline: 'central', box };
}

// Below, to the right, or above: the first that stays within the aisles' own frame, below otherwise. The frame then grows to hold it.
function besidePlacementOf(drawn: AisleRectangle, width: number, { frame, labelSize }: LabelRoom): LabelPlacement {
  const gap = labelSize / 2;
  const candidates: readonly LabelPlacement[] = [
    besideAt({ x: drawn.x, y: drawn.y + drawn.height + gap, width, height: labelSize }, 'hanging'),
    besideAt({ x: drawn.x + drawn.width + gap, y: drawn.y + drawn.height / 2 - labelSize / 2, width, height: labelSize }, 'central'),
    besideAt({ x: drawn.x, y: drawn.y - gap - labelSize, width, height: labelSize }, 'hanging'),
  ];
  const [below] = candidates as [LabelPlacement, ...LabelPlacement[]];
  return candidates.find(({ box }) => isWithin(box, frame)) ?? below;
}

function besideAt(box: AisleRectangle, baseline: LabelPlacement['baseline']): LabelPlacement {
  const y = baseline === 'hanging' ? box.y : box.y + box.height / 2;
  return { kind: 'beside', x: box.x, y, fontSize: box.height, anchor: 'start', baseline, box };
}

function widthOf(label: string, fontSize: number): number {
  const glyphs = [...label].reduce((count, character) => count + (WIDE_CHARACTER.test(character) ? 2 : 1), 0);
  return glyphs * fontSize * GLYPH_WIDTH_SHARE;
}

export function isWithin(inner: AisleRectangle, outer: AisleRectangle): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function shorterSideOf({ width, height }: AisleRectangle): number {
  return Math.min(width, height);
}

function longerSideOf({ width, height }: AisleRectangle): number {
  return Math.max(width, height);
}
