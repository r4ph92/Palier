import { describe, expect, it } from 'vitest';
import { planFrameOf } from '../src/lotMap/planFrame.ts';

describe('the frame of a level plan preview', () => {
  it('leaves a margin around aisles A and B, so their outer strokes stay inside', () => {
    const frame = planFrameOf([
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 50, width: 100, height: 40 },
    ]);

    expect(frame).toEqual({ x: -4, y: -4, width: 108, height: 98 });
  });

  it('gives a long thin aisle a frame at most four times wider than tall, the aisle kept at the left', () => {
    const frame = planFrameOf([{ x: 0, y: 0, width: 10_000, height: 40 }]);

    expect(frame.width / frame.height).toBeCloseTo(4);
    expect(frame.x).toBe(-400);
    expect(frame.y + frame.height / 2).toBeCloseTo(20);
  });

  it('gives a tall narrow aisle a frame at most four times taller than wide', () => {
    const frame = planFrameOf([{ x: 0, y: 0, width: 40, height: 10_000 }]);

    expect(frame.height / frame.width).toBeCloseTo(4);
  });
});
