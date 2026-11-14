import { describe, expect, it } from 'vitest';
import { drawnRectangleOf, labelPlacementOf, planLayoutOf } from '../src/lotMap/planLayout.ts';

const thinAisle = { x: 0, y: 0, width: 10_000, height: 40 };

describe('the layout of a level plan preview', () => {
  it('draws a 10 000 × 40 aisle at least 8 % of the framed shorter side tall, centred on its true position', () => {
    const layout = planLayoutOf([thinAisle]);
    const drawn = drawnRectangleOf(thinAisle, layout.minimumSide);

    expect(drawn.height / Math.min(layout.frame.width, layout.frame.height)).toBeGreaterThan(0.07);
    expect(drawn.y + drawn.height / 2).toBe(20);
    expect(drawn.width).toBe(10_000);
    expect(drawn.y).toBeGreaterThan(layout.frame.y);
    expect(drawn.y + drawn.height).toBeLessThan(layout.frame.y + layout.frame.height);
  });

  it('puts the code of a thin aisle beside it, below, inside the frame', () => {
    const layout = planLayoutOf([thinAisle]);
    const drawn = drawnRectangleOf(thinAisle, layout.minimumSide);

    const placement = labelPlacementOf(drawn, 'ALLEE-NORD', layout);

    expect(placement).toMatchObject({ kind: 'beside', x: 0, fontSize: layout.labelSize, baseline: 'hanging' });
    expect(placement.y).toBeGreaterThan(drawn.y + drawn.height);
    expect(placement.y + placement.fontSize).toBeLessThanOrEqual(layout.frame.y + layout.frame.height);
  });

  it('puts the code of a tall narrow aisle to its right, where the frame has room', () => {
    const tallAisle = { x: 0, y: 0, width: 40, height: 10_000 };
    const layout = planLayoutOf([tallAisle]);
    const drawn = drawnRectangleOf(tallAisle, layout.minimumSide);

    const placement = labelPlacementOf(drawn, 'V', layout);

    expect(placement).toMatchObject({ kind: 'beside', baseline: 'central' });
    expect(placement.x).toBeGreaterThan(drawn.x + drawn.width);
  });

  it('keeps the code inside an aisle large enough to hold it', () => {
    const aisles = [
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 50, width: 100, height: 40 },
    ];
    const layout = planLayoutOf(aisles);

    expect(labelPlacementOf(drawnRectangleOf(aisles[0] ?? thinAisle, layout.minimumSide), 'A', layout)).toEqual({ kind: 'inside', x: 50, y: 20, fontSize: 20 });
  });
});
