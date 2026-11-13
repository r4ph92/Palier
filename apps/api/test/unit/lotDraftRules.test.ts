import { describe, expect, it } from 'vitest';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { lotDraftErrors, type LotDraft } from '@palier/shared-types/lotDraft';

const garageRoyNord: LotDraft = { name: 'Garage Roy Nord', address: '8000, boulevard Saint-Laurent, Montréal', latitude: 45.54, longitude: -73.62, capacity: 40 };

describe('the rule for a new lot', () => {
  it('accepts Garage Roy Nord with an address, coordinates and a capacity of 40', () => {
    expect(lotDraftErrors(garageRoyNord)).toEqual({});
  });

  it.each([
    ['a blank name', { name: '   ' }, { name: 'LOT_NAME_REQUIRED' }],
    ['a 121-character name', { name: 'x'.repeat(121) }, { name: 'LOT_NAME_INVALID' }],
    ['a name of zero-width spaces', { name: '​​' }, { name: 'LOT_NAME_INVALID' }],
    ['a name holding NUL', { name: 'Garage\u0000Nord' }, { name: 'LOT_NAME_INVALID' }],
    ['an empty address', { address: '' }, { address: 'LOT_ADDRESS_REQUIRED' }],
    ['a 201-character address', { address: 'a'.repeat(201) }, { address: 'LOT_ADDRESS_INVALID' }],
    ['a latitude past the pole', { latitude: 90.5 }, { latitude: 'LOT_LATITUDE_INVALID' }],
    ['a longitude past the date line', { longitude: -180.5 }, { longitude: 'LOT_LONGITUDE_INVALID' }],
    ['a latitude that is not a number', { latitude: Number.NaN }, { latitude: 'LOT_LATITUDE_INVALID' }],
    ['a negative capacity', { capacity: -1 }, { capacity: 'LOT_CAPACITY_INVALID' }],
    ['a fractional capacity', { capacity: 40.5 }, { capacity: 'LOT_CAPACITY_INVALID' }],
    ['a capacity of 10 001', { capacity: 10_001 }, { capacity: 'LOT_CAPACITY_INVALID' }],
  ])('refuses %s on its own field', (_case, change: Partial<LotDraft>, expected) => {
    expect(lotDraftErrors({ ...garageRoyNord, ...change })).toEqual(expected);
  });

  it.each([
    ['a one-letter name', { name: 'N' }],
    ['a 120-character accented name', { name: 'É'.repeat(120) }],
    ['a 200-character address', { address: 'a'.repeat(200) }],
    ['the poles and the date line', { latitude: -90, longitude: 180 }],
    ['a capacity of 0, a lot still being fitted', { capacity: 0 }],
    ['a capacity of 10 000', { capacity: 10_000 }],
  ])('accepts %s', (_case, change: Partial<LotDraft>) => {
    expect(lotDraftErrors({ ...garageRoyNord, ...change })).toEqual({});
  });

  it('answers the name first when every field is wrong', () => {
    const errors = lotDraftErrors({ name: '', address: '', latitude: 91, longitude: 181, capacity: -1 });

    expect(Object.keys(errors)).toEqual(['name', 'address', 'latitude', 'longitude', 'capacity']);
    expect(firstFieldError(errors)).toBe('LOT_NAME_REQUIRED');
  });
});
