import { describe, expect, it } from 'vitest';
import { chooseReplacementSpot } from '../../src/domain/allocation/chooseReplacementSpot.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';
import { freeSpotFixture } from './fakes/freeSpotFixture.ts';

const AISLE_A = { id: 'A-1', aisleId: 'aisle-A' };
const electricCar = { ...standardNeeds, isElectric: true };

describe('chooseReplacementSpot (story #23)', () => {
  it('gives Julie A-2 in the aisle of her taken spot A-1, though aisle B has more free spots', () => {
    const freeSpots = [freeSpotFixture('A-2'), freeSpotFixture('B-1'), freeSpotFixture('B-2'), freeSpotFixture('B-3')];

    expect(chooseReplacementSpot(standardNeeds, freeSpots, AISLE_A)?.number).toBe('A-2');
  });

  it('gives the aisle-B spot the allocation rules choose when aisle A has no other fitting free spot', () => {
    const freeSpots = [freeSpotFixture('A-5', { isEv: true }), freeSpotFixture('B-4'), freeSpotFixture('B-2'), freeSpotFixture('C-1', { levelOrder: 2 })];

    expect(chooseReplacementSpot(standardNeeds, freeSpots, AISLE_A)?.number).toBe('B-2');
  });

  it('keeps an electric car in aisle A on a standard spot before an electric spot of aisle B', () => {
    const freeSpots = [freeSpotFixture('A-3'), freeSpotFixture('B-5', { isEv: true })];

    expect(chooseReplacementSpot(electricCar, freeSpots, AISLE_A)?.number).toBe('A-3');
  });

  it('never gives an accessible spot of the same aisle to a driver without a permit', () => {
    const freeSpots = [freeSpotFixture('A-4', { isAccessible: true }), freeSpotFixture('B-1')];

    expect(chooseReplacementSpot(standardNeeds, freeSpots, AISLE_A)?.number).toBe('B-1');
  });

  it('answers null when free spots remain but none fits the vehicle', () => {
    expect(chooseReplacementSpot(standardNeeds, [freeSpotFixture('A-5', { isEv: true }), freeSpotFixture('B-5', { isAccessible: true })], AISLE_A)).toBeNull();
  });

  it('answers null when no spot is free in the lot', () => {
    expect(chooseReplacementSpot(standardNeeds, [], AISLE_A)).toBeNull();
  });

  it('never hands back the reported A-1, even freed by an operator and nearest the exit', () => {
    expect(chooseReplacementSpot(standardNeeds, [freeSpotFixture('A-1'), freeSpotFixture('A-3')], AISLE_A)?.number).toBe('A-3');
  });
});
