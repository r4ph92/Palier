import type { AisleRectangle } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import { isWithin, planLayoutOf, type PlanAisleShape, type PlanLayout } from '../src/lotMap/planLayout.ts';

const thinAisle = { x: 0, y: 0, width: 10_000, height: 40 };
const tallAisle = { x: 0, y: 0, width: 40, height: 10_000 };
const parkingDemo = [
  { rectangle: { x: 0, y: 0, width: 100, height: 40 }, label: 'A' },
  { rectangle: { x: 0, y: 50, width: 100, height: 40 }, label: 'B' },
];

function onlyAisleOf(layout: PlanLayout) {
  const [aisle] = layout.aisles;
  if (aisle === undefined) {
    throw new Error('The layout has no aisle.');
  }
  return aisle;
}

function shorterSideOf({ width, height }: AisleRectangle): number {
  return Math.min(width, height);
}

function expectEverythingInsideTheFrame(layout: PlanLayout): void {
  for (const { drawn, label, placement } of layout.aisles) {
    expect(isWithin(drawn, layout.frame), `aisle ${label}`).toBe(true);
    expect(isWithin(placement.box, layout.frame), `label ${label}`).toBe(true);
  }
}

function expectNoHairline(layout: PlanLayout): void {
  for (const { drawn } of layout.aisles) {
    expect(shorterSideOf(drawn) / shorterSideOf(layout.frame)).toBeGreaterThan(0.05);
  }
}

describe('the layout of a level plan preview', () => {
  it('draws a 10 000 × 40 aisle as a strip, centred on its true position', () => {
    const layout = planLayoutOf([{ rectangle: thinAisle, label: 'ALLEE-NORD' }]);
    const { drawn } = onlyAisleOf(layout);

    expect(drawn.height / shorterSideOf(layout.frame)).toBeGreaterThan(0.07);
    expect(drawn.y + drawn.height / 2).toBe(20);
    expect(drawn.width).toBe(10_000);
  });

  it('puts the code of a thin aisle beside it, below', () => {
    const { drawn, placement } = onlyAisleOf(planLayoutOf([{ rectangle: thinAisle, label: 'ALLEE-NORD' }]));

    expect(placement).toMatchObject({ kind: 'beside', x: 0, baseline: 'hanging', anchor: 'start' });
    expect(placement.y).toBeGreaterThan(drawn.y + drawn.height);
  });

  it('puts a short code of a tall narrow aisle to its right', () => {
    const { drawn, placement } = onlyAisleOf(planLayoutOf([{ rectangle: tallAisle, label: 'V' }]));

    expect(placement).toMatchObject({ kind: 'beside', baseline: 'central' });
    expect(placement.x).toBeGreaterThan(drawn.x + drawn.width);
  });

  it('keeps the code inside an aisle large enough to hold it', () => {
    const [first] = planLayoutOf(parkingDemo).aisles;

    expect(first?.placement).toMatchObject({ kind: 'inside', x: 50, y: 20, fontSize: 20, anchor: 'middle', baseline: 'central' });
  });
});

describe('the frame of a level plan preview', () => {
  const corner = (x: number, y: number, label: string) => ({ rectangle: { x, y, width: 40, height: 40 }, label });
  const plans: Record<string, readonly PlanAisleShape[]> = {
    'a tall aisle at the top left with a long code': [{ rectangle: tallAisle, label: 'RAMPE-EST' }],
    'a wide aisle at the bottom': [
      { rectangle: { x: 0, y: 0, width: 100, height: 40 }, label: 'A' },
      { rectangle: { x: 0, y: 9_960, width: 10_000, height: 40 }, label: 'QUAI-SUD-LIVRAISONS' },
    ],
    'a wide aisle alone with a long code': [{ rectangle: thinAisle, label: 'ALLEE-NORD-LONGUE-DE-DIX-MILLE' }],
    'an aisle in each corner': [corner(0, 0, 'NO-1'), corner(9_960, 0, 'NE-2'), corner(0, 9_960, 'SO-3'), corner(9_960, 9_960, 'SE-4')],
    'a mixed plan of wide, tall and small aisles': [
      { rectangle: thinAisle, label: 'NORD' },
      { rectangle: { x: 9_960, y: 0, width: 40, height: 6_000 }, label: 'RAMPE-EST' },
      corner(0, 5_960, 'P'),
    ],
    'the seeded Parking Démo plan': parkingDemo,
    'codes of wide characters': [{ rectangle: tallAisle, label: '駐車場🚗' }],
  };

  for (const [name, aisles] of Object.entries(plans)) {
    it(`holds every aisle and every code for ${name}`, () => {
      expectEverythingInsideTheFrame(planLayoutOf(aisles));
    });

    it(`draws no aisle as a hairline for ${name}`, () => {
      expectNoHairline(planLayoutOf(aisles));
    });
  }

  it('grows the frame above a tall top-left aisle rather than cut its code', () => {
    const layout = planLayoutOf([{ rectangle: tallAisle, label: 'RAMPE-EST' }]);
    const { placement } = onlyAisleOf(layout);

    expect(placement.box.y).toBeGreaterThan(layout.frame.y);
    expect(placement.box.x + placement.box.width).toBeLessThan(layout.frame.x + layout.frame.width);
  });
});
