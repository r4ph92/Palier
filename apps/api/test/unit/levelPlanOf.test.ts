import { describe, expect, it } from 'vitest';
import { levelPlanOf } from '../../src/domain/lots/levelPlanOf.ts';
import { PARKING_DEMO_P1_AISLES } from './fakes/fakeCurrentParkingSessions.ts';

describe('levelPlanOf', () => {
  it('lists every aisle of level P1 with its minor and rectangle', () => {
    expect(levelPlanOf('P1', PARKING_DEMO_P1_AISLES)).toEqual({
      levelPlan: {
        levelCode: 'P1',
        aisles: [
          { code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } },
          { code: 'B', beaconMinor: 2, rectangle: { x: 0, y: 50, width: 100, height: 40 } },
        ],
      },
      rejectedAisleCodes: [],
    });
  });

  it('keeps undrawn aisles in the plan so the driver is still guided by code', () => {
    const undrawn = [
      { code: 'A', beaconMinor: 1, mapPolygon: null },
      { code: 'C', beaconMinor: 3, mapPolygon: null },
    ];

    expect(levelPlanOf('P1', undrawn)).toEqual({
      levelPlan: { levelCode: 'P1', aisles: [{ code: 'A', beaconMinor: 1, rectangle: null }, { code: 'C', beaconMinor: 3, rectangle: null }] },
      rejectedAisleCodes: [],
    });
  });

  it('serves a rejected aisle undrawn and names it, never an absent one', () => {
    const stored = [
      { code: 'A', beaconMinor: 1, mapPolygon: { x: 0, y: 0, width: -5, height: 40 } },
      { code: 'B', beaconMinor: 2, mapPolygon: null },
    ];

    const { levelPlan, rejectedAisleCodes } = levelPlanOf('P1', stored);

    expect(levelPlan?.aisles.map(({ rectangle }) => rectangle)).toEqual([null, null]);
    expect(rejectedAisleCodes).toEqual(['A']);
  });

  it('has no plan for a level without aisles', () => {
    expect(levelPlanOf('P1', [])).toEqual({ levelPlan: null, rejectedAisleCodes: [] });
  });
});
