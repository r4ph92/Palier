import { describe, expect, it } from 'vitest';
import { chooseReplacementSpot } from '../../src/domain/allocation/chooseReplacementSpot.ts';
import type { FreeSpot } from '../../src/domain/allocation/chooseSpot.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';

type Feature = Partial<Pick<FreeSpot, 'isEv' | 'isAccessible' | 'levelOrder'>>;

function spot(number: string, feature: Feature = {}): FreeSpot {
  const [aisleCode = '', position = '0'] = number.split('-');
  return {
    id: number,
    number,
    levelOrder: 1,
    aisleId: `aisle-${aisleCode}`,
    aisleCode,
    distanceToExit: Number(position) * 5,
    needsCheck: false,
    isEv: false,
    isAccessible: false,
    isOversize: false,
    ...feature,
  };
}

const AISLE_A = { id: 'A-1', aisleId: 'aisle-A' };
const electricCar = { ...standardNeeds, isElectric: true };

describe('chooseReplacementSpot (story #23)', () => {
  it('gives Julie A-2 in the aisle of her taken spot A-1, though aisle B has more free spots', () => {
    const freeSpots = [spot('A-2'), spot('B-1'), spot('B-2'), spot('B-3')];

    expect(chooseReplacementSpot(standardNeeds, freeSpots, AISLE_A)?.number).toBe('A-2');
  });

  it('gives the aisle-B spot the allocation rules choose when aisle A has no other fitting free spot', () => {
    const freeSpots = [spot('A-5', { isEv: true }), spot('B-4'), spot('B-2'), spot('C-1', { levelOrder: 2 })];

    expect(chooseReplacementSpot(standardNeeds, freeSpots, AISLE_A)?.number).toBe('B-2');
  });

  it('keeps an electric car in aisle A on a standard spot before an electric spot of aisle B', () => {
    const freeSpots = [spot('A-3'), spot('B-5', { isEv: true })];

    expect(chooseReplacementSpot(electricCar, freeSpots, AISLE_A)?.number).toBe('A-3');
  });

  it('never gives an accessible spot of the same aisle to a driver without a permit', () => {
    const freeSpots = [spot('A-4', { isAccessible: true }), spot('B-1')];

    expect(chooseReplacementSpot(standardNeeds, freeSpots, AISLE_A)?.number).toBe('B-1');
  });

  it('answers null when free spots remain but none fits the vehicle', () => {
    expect(chooseReplacementSpot(standardNeeds, [spot('A-5', { isEv: true }), spot('B-5', { isAccessible: true })], AISLE_A)).toBeNull();
  });

  it('answers null when no spot is free in the lot', () => {
    expect(chooseReplacementSpot(standardNeeds, [], AISLE_A)).toBeNull();
  });

  it('never hands back the reported A-1, even freed by an operator and nearest the exit', () => {
    expect(chooseReplacementSpot(standardNeeds, [spot('A-1'), spot('A-3')], AISLE_A)?.number).toBe('A-3');
  });
});
