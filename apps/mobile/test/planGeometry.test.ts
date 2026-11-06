import { planGeometryOf } from '../src/parkingSessions/planGeometry';
import type { PlanAisle } from '@palier/shared-types';
import { parkingDemoP1Plan } from './fakeParkingSessionClient';

const [aisleA, aisleB] = parkingDemoP1Plan.aisles as [PlanAisle, PlanAisle];

describe('planGeometryOf', () => {
  it('frames aisles A and B of level P1 inside their bounding box', () => {
    const geometry = planGeometryOf(parkingDemoP1Plan.aisles);

    expect(geometry?.aspectRatio).toBeCloseTo(100 / 90);
    expect(geometry?.frames.map(({ aisle, ...frame }) => [aisle.code, frame])).toEqual([
      ['A', { left: '0%', top: '0%', width: '100%', height: `${(40 / 90) * 100}%` }],
      ['B', { left: '0%', top: `${(50 / 90) * 100}%`, width: '100%', height: `${(40 / 90) * 100}%` }],
    ]);
  });

  it('ignores the offset of a level drawn away from the grid origin', () => {
    const shifted = [{ code: 'C', beaconMinor: 3, rectangle: { x: 200, y: 300, width: 50, height: 25 } }];

    expect(planGeometryOf(shifted)).toEqual({ aspectRatio: 2, frames: [{ aisle: shifted[0], left: '0%', top: '0%', width: '100%', height: '100%' }] });
  });

  it('leaves undrawn aisles out of the drawing', () => {
    const aisles = [{ ...aisleA, rectangle: null }, aisleB];

    expect(planGeometryOf(aisles)?.frames.map(({ aisle }) => aisle.code)).toEqual(['B']);
  });

  it('draws nothing when no aisle has a rectangle', () => {
    expect(planGeometryOf(parkingDemoP1Plan.aisles.map((aisle) => ({ ...aisle, rectangle: null })))).toBeNull();
  });
});
