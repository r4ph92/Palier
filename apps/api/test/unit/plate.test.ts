import { describe, expect, it } from 'vitest';
import { readPlate } from '../../src/domain/vehicles/plate.ts';

describe('readPlate', () => {
  it('shows the plate upper-case with its spaces and matches it without them', () => {
    expect(readPlate(' abc 123 ')).toEqual({ plate: 'ABC 123', plateKey: 'ABC123' });
  });

  it('keeps hyphens in the plate', () => {
    expect(readPlate('ab-12')).toEqual({ plate: 'AB-12', plateKey: 'AB-12' });
  });

  it('accepts a plate of exactly eight characters', () => {
    expect(readPlate('ABCD1234')).toEqual({ plate: 'ABCD1234', plateKey: 'ABCD1234' });
  });

  it('refuses an empty plate or one made only of spaces', () => {
    expect(readPlate('')).toBeNull();
    expect(readPlate('   ')).toBeNull();
  });

  it('refuses a plate longer than eight characters', () => {
    expect(readPlate('ABCD12345')).toBeNull();
  });

  it('refuses characters other than letters, digits, spaces and hyphens', () => {
    expect(readPlate('AB_123')).toBeNull();
    expect(readPlate('AB.123')).toBeNull();
    expect(readPlate('ÉT-123')).toBeNull();
  });
});
