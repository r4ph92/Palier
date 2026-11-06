import { describe, expect, it } from 'vitest';
import type { FreeSpot } from '../../src/domain/allocation/chooseSpot.ts';
import { chooseSpotFor } from '../../src/domain/allocation/chooseSpotFor.ts';
import type { VehicleNeeds } from '../../src/domain/vehicles/VehicleRepository.ts';

type Feature = Partial<Pick<FreeSpot, 'isEv' | 'isAccessible' | 'isOversize'>>;

function spot(number: string, feature: Feature = {}, levelOrder = 1): FreeSpot {
  const [aisleCode = '', position = '0'] = number.split('-');
  return {
    id: number,
    number,
    levelOrder,
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

// Entrée Démo's spots: A-5 electric, B-4 oversize, B-5 accessible, the others standard.
const A1 = spot('A-1');
const B1 = spot('B-1');
const A5 = spot('A-5', { isEv: true });
const B4 = spot('B-4', { isOversize: true });
const B5 = spot('B-5', { isAccessible: true });

const standardCar: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };
const amelie: VehicleNeeds = { isElectric: true, hasAccessiblePermit: true, isOversize: false };
const largeVehicle: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: true };

function refusalOf(needs: VehicleNeeds, freeSpots: readonly FreeSpot[]): unknown {
  try {
    chooseSpotFor(needs, freeSpots);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('chooseSpotFor', () => {
  it('gives an electric driver with a permit the accessible spot first', () => {
    expect(chooseSpotFor(amelie, [A1, B1, A5, B4, B5])?.number).toBe('B-5');
  });

  it('gives that driver the electric spot when the accessible one is taken', () => {
    expect(chooseSpotFor(amelie, [A1, B1, A5, B4])?.number).toBe('A-5');
  });

  it('gives that driver a standard spot when both are taken', () => {
    expect(chooseSpotFor(amelie, [A1, B4])?.number).toBe('A-1');
  });

  it('gives an electric driver without a permit the electric spot, never the accessible one', () => {
    const electricCar = { ...standardCar, isElectric: true };

    expect(chooseSpotFor(electricCar, [A1, A5, B5])?.number).toBe('A-5');
    expect(chooseSpotFor(electricCar, [A1, B5])?.number).toBe('A-1');
  });

  it('gives the matching spot on a later level before a standard spot on the first level', () => {
    expect(chooseSpotFor(amelie, [A1, spot('C-5', { isAccessible: true }, 2)])?.number).toBe('C-5');
  });

  it('keeps the level and aisle order among standard spots', () => {
    expect(chooseSpotFor(standardCar, [spot('C-1', {}, 2), B1, spot('A-2'), A1])?.number).toBe('A-1');
  });

  it('refuses a standard car NO_SUITABLE_SPOT when only the electric and accessible spots are free', () => {
    expect(refusalOf(standardCar, [A5, B5])).toMatchObject({ reason: 'NO_SUITABLE_SPOT' });
  });

  it('gives a standard car a standard spot before the oversize one', () => {
    expect(chooseSpotFor(standardCar, [B4, B1])?.number).toBe('B-1');
  });

  it('gives a standard car the oversize spot when it is the only one free', () => {
    expect(chooseSpotFor(standardCar, [B4])?.number).toBe('B-4');
  });

  it('gives an oversize vehicle the oversize spot', () => {
    expect(chooseSpotFor(largeVehicle, [A1, B4])?.number).toBe('B-4');
  });

  it('refuses an oversize vehicle NO_SUITABLE_SPOT when no oversize spot is free, even with standard spots free', () => {
    expect(refusalOf(largeVehicle, [A1, B1, A5, B5])).toMatchObject({ reason: 'NO_SUITABLE_SPOT' });
  });

  it('keeps a spot that is both electric and accessible from an electric driver without a permit', () => {
    const electricCar = { ...standardCar, isElectric: true };
    const electricAndAccessible = spot('C-1', { isEv: true, isAccessible: true });

    expect(chooseSpotFor(electricCar, [electricAndAccessible, A1])?.number).toBe('A-1');
    expect(refusalOf(electricCar, [electricAndAccessible])).toMatchObject({ reason: 'NO_SUITABLE_SPOT' });
    expect(chooseSpotFor(amelie, [electricAndAccessible, A1])?.number).toBe('C-1');
  });

  it('keeps an oversize spot that is also accessible from an oversize vehicle without a permit', () => {
    const oversizeAndAccessible = spot('C-2', { isOversize: true, isAccessible: true });

    expect(chooseSpotFor(largeVehicle, [oversizeAndAccessible, B4])?.number).toBe('B-4');
    expect(refusalOf(largeVehicle, [oversizeAndAccessible])).toMatchObject({ reason: 'NO_SUITABLE_SPOT' });
    expect(chooseSpotFor({ ...largeVehicle, hasAccessiblePermit: true }, [oversizeAndAccessible])?.number).toBe('C-2');
  });

  it('returns null, not a refusal, when no spot is free at all', () => {
    expect(chooseSpotFor(amelie, [])).toBeNull();
  });
});
